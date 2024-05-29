#!/bin/bash

sudo pigpiod

screen -S camera -X quit
screen -S webapp -X quit


cd /home/osman/fishpi/
screen -dmS camera python3 /home/osman/fishpi/app.py
cd /home/osman/fishpi/backend/
screen -dmS webapp node /home/osman/fishpi/backend/backend.js

echo "screens 'camera' and 'webapp' created"
echo "attach with screen -r [name]"
