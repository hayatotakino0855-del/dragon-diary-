from PIL import Image
img1 = Image.open('assets/dragons/stage1_egg.png').convert('RGBA')
data1 = img1.getdata()
w = img1.width
h = img1.height
min_y = h
max_y = 0
min_x = w
max_x = 0
for y in range(h):
    for x in range(w):
        if data1[y*w+x][3] > 0:
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            min_x = min(min_x, x)
            max_x = max(max_x, x)
print("Stage 1 Egg:", w, "x", h, "Bounds:", max_x - min_x, "x", max_y - min_y)
