v0.5

- Changed image saving
    - Images are now saved to local storage with a file path in the firebase entry URL
    - This is a fix for Discord CDN URLs getting corrupted or deleted over time
- Added a script to add to cron for automatic daily restarts 
    - noticed app crashed and decided I should add this
- Change timestamp logic in Firebase