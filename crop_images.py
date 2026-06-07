from PIL import Image

img1 = Image.open('assets/dragons/stage2_egg_only.png').convert('RGBA')
img2 = Image.open('assets/dragons/stage2_nest.png').convert('RGBA')

data1 = img1.getdata()
data2 = img2.getdata()
w, h = img1.size

min_y = h
max_y = 0
min_x = w
max_x = 0

for y in range(h):
    for x in range(w):
        if data1[y * w + x][3] > 0 or data2[y * w + x][3] > 0:
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            min_x = min(min_x, x)
            max_x = max(max_x, x)

# Add some padding
padding = 20
min_x = max(0, min_x - padding)
max_x = min(w, max_x + padding)
min_y = max(0, min_y - padding)
max_y = min(h, max_y + padding)

print(f"Cropping to: x=({min_x}, {max_x}), y=({min_y}, {max_y})")

img1_cropped = img1.crop((min_x, min_y, max_x, max_y))
img2_cropped = img2.crop((min_x, min_y, max_x, max_y))

img1_cropped.save('assets/dragons/stage2_egg_only.png')
img2_cropped.save('assets/dragons/stage2_nest.png')

print("Cropped successfully!")
