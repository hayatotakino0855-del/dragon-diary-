from PIL import Image

img = Image.open('assets/dragons/stage2_egg_only.png').convert('RGBA')
data = img.getdata()
w, h = img.size
min_y = h
max_y = 0
min_x = w
max_x = 0

for y in range(h):
    for x in range(w):
        if data[y * w + x][3] > 0:
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            min_x = min(min_x, x)
            max_x = max(max_x, x)

print('Egg Bounds:', min_x, max_x, min_y, max_y, 'W:', max_x - min_x, 'H:', max_y - min_y)

img2 = Image.open('assets/dragons/stage2_nest.png').convert('RGBA')
data2 = img2.getdata()
min_y2 = h
max_y2 = 0
for y in range(h):
    for x in range(w):
        if data2[y * w + x][3] > 0:
            min_y2 = min(min_y2, y)
            max_y2 = max(max_y2, y)
print('Nest Bounds:', min_y2, max_y2)
