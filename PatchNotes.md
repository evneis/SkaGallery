v0.3

- Scans for images/gifs it might have missed during expected/unexpected downtime
    - Handles reactions specific to zap emoji - if new reactions are made then ready.js will need to be updated
- Replying /delete to a bot posted image will remove the image from the database
- Replying /untag to a bot posted image that was called using a tag-related slash command
- Reacting/Unreacting to a duplicate image will still properly handle image tags