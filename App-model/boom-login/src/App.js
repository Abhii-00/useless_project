import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js'; // CORRECT WAY TO IMPORT
import './App.css';

const CORRECT_USERNAME = 'admin';
const CORRECT_PASSWORD = 'password123';

const SuccessContent = ({ memeFaceImage }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const setupCanvas = async () => {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const response = await fetch('/video-head-data.json');
        if (!response.ok) throw new Error('Failed to load face data');
        const headData = await response.json();

        const memeFaceImg = new Image();
        memeFaceImg.src = memeFaceImage;
        await new Promise((resolve) => {
          memeFaceImg.onload = resolve;
          memeFaceImg.onerror = resolve;
        });

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const renderFrame = () => {
          try {
            const frameIndex = Math.floor(video.currentTime * 30);
            const headInfo = headData[frameIndex];

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            if (headInfo && memeFaceImg.complete) {
              const scale = canvas.width / video.videoWidth;
              const faceWidth = headInfo.width * scale * 1.2;
              const faceHeight = headInfo.height * scale * 1.2;
              const x = headInfo.x * scale - (faceWidth - headInfo.width * scale) / 2;
              const y = headInfo.y * scale - (faceHeight - headInfo.height * scale) / 2;
              
              ctx.drawImage(memeFaceImg, x, y, faceWidth, faceHeight);
            }

            if (!video.paused && !video.ended) {
              animationFrameId.current = requestAnimationFrame(renderFrame);
            }
          } catch (error) {
            console.error('Error rendering frame:', error);
          }
        };

        const resizeCanvas = () => {
          const container = canvas.parentElement;
          const maxWidth = Math.min(container.clientWidth, 800);
          const aspectRatio = video.videoWidth / video.videoHeight;
          canvas.width = maxWidth;
          canvas.height = maxWidth / aspectRatio;
          renderFrame();
        };

        const handleLoadedData = () => {
          resizeCanvas();
          window.addEventListener('resize', resizeCanvas);
        };

        video.addEventListener('loadeddata', handleLoadedData);
        
        video.muted = isMuted;
        video.play().catch(e => console.log('Meme video play error:', e));

        return () => {
          video.removeEventListener('loadeddata', handleLoadedData);
          window.removeEventListener('resize', resizeCanvas);
          if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
          }
        };
      } catch (error) {
        console.error('Error setting up canvas:', error);
      }
    };

    setupCanvas();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [memeFaceImage, isMuted]);

  return (
    <div className="success-container">
      <video
        ref={videoRef}
        src="/thoppi.mp4"
        autoPlay
        loop
        muted={isMuted}
        playsInline
        style={{ display: 'none' }}
      />
      <canvas ref={canvasRef} className="meme-video" />
      
      <div className="action-buttons">
        <button 
          className="audio-toggle"
          onClick={() => setIsMuted(!isMuted)}
        >
          {isMuted ? '🔇 Unmute Audio' : '🔊 Mute Audio'}
        </button>
        <button 
          className="new-meme-btn"
          onClick={() => window.location.reload()}
        >
          🔄 Create New Meme
        </button>
      </div>
    </div>
  );
};

function App() {
  const videoRef = useRef(null);
  const bgVideoRef = useRef(null);
  const [appState, setAppState] = useState('login');
  const [cameraStream, setCameraStream] = useState(null);
  const [memeFaceImage, setMemeFaceImage] = useState(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Loading face detection...');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isErrorState, setIsErrorState] = useState(false);
  const intervalIdRef = useRef(null);

  useEffect(() => {
    const bgVideo = bgVideoRef.current;
    if (bgVideo) {
      bgVideo.loop = true;
      bgVideo.muted = true;
      bgVideo.play().catch(e => console.log('BG video init error:', e));
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models')
        ]);
        if (isMounted) {
          setIsModelsLoaded(true);
          setLoadingStatus('Ready! Enter credentials to proceed.');
        }
      } catch (error) {
        console.error('Model loading error:', error);
        if (isMounted) setLoadingStatus('Model loading failed. Check browser console.');
      }
    };
    loadModels();
    return () => {
      isMounted = false;
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (appState === 'camera' && !cameraStream) {
      const getCameraStream = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'user', 
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setCameraStream(stream);
        } catch (error) {
          console.error('Camera access error:', error);
          alert('Camera access required. Please enable permissions.');
          setAppState('login');
        }
      };
      getCameraStream();
    }
  }, [appState, cameraStream]);

  const captureAndMemeifyPhoto = async () => {
    if (!videoRef.current?.videoWidth) {
      alert('Camera not ready. Please wait.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const detections = await faceapi
        .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      if (!detections) {
        alert('No face detected! Please position your face clearly in the frame and try again.');
        return;
      }

      const memeImage = await memeifyFace(canvas.toDataURL('image/jpeg'), detections);
      setMemeFaceImage(memeImage);
      
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      
      setAppState('success');
    } catch (error) {
      console.error('Capture error:', error);
      alert('Failed to create meme. Please try again.');
    }
  };

  const memeifyFace = (imageDataUrl, detections) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const { box, landmarks } = detections;
          
          const fullCanvas = document.createElement('canvas');
          fullCanvas.width = img.width;
          fullCanvas.height = img.height;
          const fullCtx = fullCanvas.getContext('2d');
          fullCtx.drawImage(img, 0, 0);

          if (landmarks) {
            const faceWidth = box.width;
            const scaleFactor = Math.max(1, faceWidth / 200);

            const mouth = landmarks.getMouth();
            const mustacheY = (mouth[0]._y + mouth[6]._y) / 2 - (10 * scaleFactor);
            
            fullCtx.fillStyle = '#333333';
            fullCtx.beginPath();
            fullCtx.ellipse(mouth[0]._x - (5 * scaleFactor), mustacheY, 25 * scaleFactor, 10 * scaleFactor, 0, 0, Math.PI * 2);
            fullCtx.ellipse(mouth[6]._x + (5 * scaleFactor), mustacheY, 25 * scaleFactor, 10 * scaleFactor, 0, 0, Math.PI * 2);
            fullCtx.fill();

            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();

            const leftEyeCenter = { 
              x: (leftEye[0]._x + leftEye[3]._x) / 2, 
              y: (leftEye[0]._y + leftEye[3]._y) / 2 
            };
            
            const rightEyeCenter = { 
              x: (rightEye[0]._x + rightEye[3]._x) / 2, 
              y: (rightEye[0]._y + rightEye[3]._y) / 2 
            };
            const eyeRadius = 15 * scaleFactor;

            fullCtx.fillStyle = '#ffffff';
            fullCtx.beginPath();
            fullCtx.arc(leftEyeCenter.x, leftEyeCenter.y, eyeRadius, 0, Math.PI * 2);
            fullCtx.arc(rightEyeCenter.x, rightEyeCenter.y, eyeRadius, 0, Math.PI * 2);
            fullCtx.fill();

            fullCtx.fillStyle = '#000000';
            fullCtx.beginPath();
            fullCtx.arc(leftEyeCenter.x, leftEyeCenter.y, 5 * scaleFactor, 0, Math.PI * 2);
            fullCtx.arc(rightEyeCenter.x, rightEyeCenter.y, 5 * scaleFactor, 0, Math.PI * 2);
            fullCtx.fill();
          }

          resolve(fullCanvas.toDataURL('image/jpeg'));
        } catch (error) {
          console.error('Memeify drawing error:', error);
          resolve(imageDataUrl); 
        }
      };
      img.onerror = () => reject(new Error('Failed to load image for memeification'));
      img.src = imageDataUrl;
    });
  };

  const handleUsernameChange = (e) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    if (newUsername !== CORRECT_USERNAME) {
      setIsErrorState(true);
      setPassword(newUsername);
    } else {
      setIsErrorState(false);
    }
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    if (isErrorState) {
      setUsername(newPassword);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === CORRECT_USERNAME && password === CORRECT_PASSWORD) {
      if (isModelsLoaded) {
        setIsLoggedIn(true);
        setLoadingStatus('Login successful. Click "Access Camera" to continue.');
      } else {
        setLoadingStatus('Please wait, AI models are still loading...');
      }
    } else {
      alert('Incorrect username or password');
    }
  };

  const accessCameraHandler = () => {
    if (isModelsLoaded && isLoggedIn) {
      setAppState('camera');
    } else if (!isLoggedIn) {
      alert('Please log in first.');
    } else {
      setLoadingStatus('AI models are still loading...');
    }
  }

  const playAudio = (src) => {
    new Audio(src).play().catch(console.error);
  };

  if (appState === 'success') {
    return <SuccessContent memeFaceImage={memeFaceImage} />;
  }

  return (
    <div className="app-container">
      <div className="video-background">
        <video 
          ref={bgVideoRef}
          autoPlay 
          loop 
          muted 
          playsInline
        >
          <source src="/background-video.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <img 
              src="/explosion-fire-ai-generated-png.webp" 
              alt="Logo" 
              className="logo" 
              onError={(e) => e.target.style.display = 'none'}
            />
            <h1>BOOM LOGIN</h1>
            <p>സുരക്ഷിതമായ ആക്‌സസ്. പരിഹാസപരമായ UX. 100% അസംബന്ധം.</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={handleUsernameChange}
              required
              disabled={isLoggedIn}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={handlePasswordChange}
              required
              disabled={isLoggedIn}
            />
            
            <div className="status">{loadingStatus}</div>
            
            <div className="button-group">
              <button 
                type="submit" 
                className="login-btn"
                disabled={!isModelsLoaded || isLoggedIn}
              >
                LOGIN
              </button>
              {isLoggedIn && (
                <button 
                  type="button" 
                  className="camera-btn"
                  onClick={accessCameraHandler}
                  disabled={!isModelsLoaded}
                >
                  ACCESS CAMERA
                </button>
              )}
            </div>

            <div className="form-footer">
              <button 
                type="button" 
                className="footer-btn"
                onClick={() => playAudio('/signup.mp3')}
              >
                Sign Up
              </button>
              <button 
                type="button" 
                className="footer-btn"
                onClick={() => playAudio('/forgetpassword.mp3')}
              >
                Forgot Password?
              </button>
            </div>
          </form>

          {appState === 'camera' && (
            <div className="camera-section">
              <div 
                className="camera-preview"
              >
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline
                  className="camera-feed"
                />
                <div className="camera-overlay">
                  <button 
                    className="capture-btn"
                    onClick={captureAndMemeifyPhoto}
                  >
                    CAPTURE
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;