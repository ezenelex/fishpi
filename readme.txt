run the camera in ~/fishpi/
$ python3 app.py

run the node app in ~/fishpi/backend/
$ npx nodemon backend.js

servo python code must have the pigpio daemon running.
this gpio factory uses DMA to get super accurate gpio timings to remove jitter in servo.
servo code must be ran by setting the GPIOZERO_PIN_FACTORY=pigpio
$ GPIOZERO_PIN_FACTORY=pigpio python3 servo.py

connect to the thing at 192.168.0.23:3000
