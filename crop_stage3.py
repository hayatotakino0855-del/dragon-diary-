from PIL import Image
img = Image.open('assets/dragons/stage3_hatch.png').convert('RGBA')
data = img.getdata()
w = img.width
h = img.height
min_y = h
max_y = 0
min_x = w
max_x = 0
for y in range(h):
    for x in range(w):
        if data[y*w+x][3] > 0:
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            min_x = min(min_x, x)
            max_x = max(max_x, x)
print("Stage 3 Hatch:", w, "x", h, "Bounds:", max_x - min_x, "x", max_y - min_y)
cropped = img.crop((min_x, min_y, max_x, max_y))
cropped.save('assets/dragons/stage3_hatch_cropped.png')
