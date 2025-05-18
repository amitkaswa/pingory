#!/data/data/com.termux/files/usr/bin/bash

git add .
echo "Enter commit message:"
read msg
git commit -m "$msg"
git push origin main
echo "✔️ Changes pushed!"
