#!/bin/bash

# Check if the process exists in PM2
if pm2 list | grep -q "skagallery"; then
    # If it exists, restart it
    /home/satanicpickle23/.nvm/versions/node/v22.16.0/bin/pm2 restart skagallery
else
    # If it doesn't exist, start it
    /home/satanicpickle23/.nvm/versions/node/v22.16.0/bin/pm2 start index.js --name "skagallery"
fi

# Log the action
echo "SkaGallery $(if pm2 list | grep -q "skagallery"; then echo "restarted"; else echo "started"; fi) at $(date)" >> "$(dirname "$0")/pm2-restart.log" 