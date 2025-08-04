import cv2
import json
import os

# --- Configuration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VIDEO_PATH = os.path.join(BASE_DIR, 'thoppi.mp4')
OUTPUT_JSON_PATH = os.path.join(BASE_DIR, 'video-head-data.json')

def generate_face_data():
    """Reads a video, detects faces in each frame, and saves the data to a JSON file."""
    
    # Load the pre-trained Haar Cascade for face detection
    # The corrected line:
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    # Check if the video file exists
    if not os.path.exists(VIDEO_PATH):
        print(f"Error: Video file not found at {VIDEO_PATH}")
        return

    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        print(f"Error: Could not open video file at {VIDEO_PATH}")
        return

    face_data = []
    frame_count = 0

    print("Starting face detection...")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray_frame, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        # We only care about the first detected face
        if len(faces) > 0:
            x, y, width, height = faces[0]
            face_data.append({'x': int(x), 'y': int(y), 'width': int(width), 'height': int(height)})
        else:
            face_data.append(None) # No face detected in this frame

        frame_count += 1
        if frame_count % 100 == 0:
            print(f"Processed {frame_count} frames...")

    cap.release()

    print("Face detection complete. Saving data...")
    
    # Save the data to a JSON file
    with open(OUTPUT_JSON_PATH, 'w') as f:
        json.dump(face_data, f, indent=2)

    print(f"Successfully generated and saved data to: {OUTPUT_JSON_PATH}")

if __name__ == '__main__':
    generate_face_data()