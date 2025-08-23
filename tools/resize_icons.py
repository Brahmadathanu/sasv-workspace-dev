"""
resize_icons.py – Generate PWA icon sizes from a 1024x1024 base image.

USAGE:
1. Open Command Prompt (Win + R → cmd).
2. Navigate to this script’s folder:
       cd "D:\ELECTRON PROJECTS\daily-worklog-app\tools"
3. Run the script with Python:
       python resize_icons.py
   (or `py resize_icons.py` if `python` isn’t recognized)

REQUIREMENTS:
- Python 3.x
- Pillow (install once via `pip install pillow`)

INPUT:
- Place your base icon file named `icon-1024.png` in the same folder as this script.

OUTPUT:
- The script generates resized icons:
    icon-48x48.png
    icon-72x72.png
    icon-96x96.png
    icon-144x144.png
    icon-152x152.png
    icon-192x192.png
    icon-384x384.png
    icon-512x512.png

These can be copied into your PWA’s `/public/utilities-hub/icons/` folder.
"""

from PIL import Image

# Load your 1024x1024 base icon
img = Image.open("icon-1024.png")

# Sizes you want
sizes = [48, 72, 96, 144, 152, 192, 384, 512]

for size in sizes:
    out = img.resize((size, size), Image.LANCZOS)
    out.save(f"icon-{size}x{size}.png")

print("✅ All icons resized successfully.")