from ultralytics import YOLO
import cv2

model = YOLO("models/best.pt")
print("Class names:", model.names)

camera = cv2.VideoCapture(0)
if not camera.isOpened():
    raise RuntimeError("Camera failed to open. Check CAMERA_INDEX.")

while True:
    success, frame = camera.read()
    if not success:
        break

    results = model(frame, verbose=False)
    annotated = results[0].plot()

    cv2.imshow("YOLO Live Detection", annotated)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()
