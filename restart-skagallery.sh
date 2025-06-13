#!/bin/bash

if pm2 list | grep -q "skagallery"; then
    /home/satanicpickle23/.nvm/versions/node/v22.16.0/bin/pm2 restart skagallery
else
    /home/satanicpickle23/.nvm/versions/node/v22.16.0/bin/pm2 start index.js --name "skagallery"
fi
echo "SkaGallery $(if pm2 list | grep -q "skagallery"; then echo "restarted"; else echo "started"; fi) at $(date)" >> "$(dirname "$0")/pm2-restart.log" 