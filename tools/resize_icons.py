from PIL import Image

# Load your 1024x1024 base icon
img = Image.open("icon-1024.png")

# Sizes you want
sizes = [48, 72, 96, 144, 152, 192, 384, 512]

for size in sizes:
    out = img.resize((size, size), Image.LANCZOS)
    out.save(f"icon-{size}x{size}.png")

print("✅ All icons resized successfully.")