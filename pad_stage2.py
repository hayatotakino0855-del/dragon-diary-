from PIL import Image

# 1. Get Stage 1 dimensions and bounding box
img1 = Image.open('assets/dragons/stage1_egg.png').convert('RGBA')
w1, h1 = img1.width, img1.height
data = img1.getdata()
min_y, max_y, min_x, max_x = h1, 0, w1, 0
for y in range(h1):
    for x in range(w1):
        if data[y*w1+x][3] > 10:
            min_y, max_y = min(min_y, y), max(max_y, y)
            min_x, max_x = min(min_x, x), max(max_x, x)

egg1_w = max_x - min_x
egg1_h = max_y - min_y
print(f"Stage 1 Canvas: {w1}x{h1}, Egg Size: {egg1_w}x{egg1_h}, Center: {(min_x+max_x)//2}, {(min_y+max_y)//2}")

# 2. Resize the cracked egg to exactly match the Stage 1 egg's size
img2 = Image.open('assets/dragons/stage3_new.jpg').convert('RGBA')
from rembg import remove
img2_nobg = remove(img2)

# crop the removed bg image
data2 = img2_nobg.getdata()
min_y2, max_y2, min_x2, max_x2 = img2_nobg.height, 0, img2_nobg.width, 0
for y in range(img2_nobg.height):
    for x in range(img2_nobg.width):
        if data2[y*img2_nobg.width+x][3] > 10:
            min_y2, max_y2 = min(min_y2, y), max(max_y2, y)
            min_x2, max_x2 = min(min_x2, x), max(max_x2, x)

img2_cropped = img2_nobg.crop((min_x2, min_y2, max_x2, max_y2))

# scale to match stage 1
# Actually, cracked egg has a wider base due to aura. Let's scale by height to match egg1_h
scale = egg1_h / float(max_y2 - min_y2)
new_w = int((max_x2 - min_x2) * scale)
img2_resized = img2_cropped.resize((new_w, egg1_h), Image.Resampling.LANCZOS)

# Create 1024x1024 canvas and paste
out_img = Image.new('RGBA', (w1, h1), (0,0,0,0))
# center horizontally, align vertically
paste_x = (w1 - new_w) // 2
paste_y = min_y
out_img.paste(img2_resized, (paste_x, paste_y))
out_img.save('assets/dragons/stage2_egg_only.png')
print("Saved scaled stage2_egg_only.png")

# 3. Do the same for the nest
try:
    nest_orig = Image.open('C:/Users/User/.gemini/antigravity/brain/b9fa9caf-1a4e-408d-9ee3-34abb61094e0/media__1779586209551.png').convert('RGBA') # Original nest
    # the nest should sit at the bottom of the egg
    # Let's just scale it relative to the canvas. 
    # Or just use the already cropped stage2_nest.png and resize it?
    nest_cropped = Image.open('assets/dragons/stage2_nest.png').convert('RGBA')
    # scale nest
    nest_scale = new_w / float(nest_cropped.width) * 1.5 # make it a bit wider than the egg
    nest_new_w = int(nest_cropped.width * nest_scale)
    nest_new_h = int(nest_cropped.height * nest_scale)
    nest_resized = nest_cropped.resize((nest_new_w, nest_new_h), Image.Resampling.LANCZOS)
    
    out_nest = Image.new('RGBA', (w1, h1), (0,0,0,0))
    nest_x = (w1 - nest_new_w) // 2
    # position it at the bottom of the egg
    # To move it slightly upwards, we increase the offset subtracted from the bottom
    nest_y = paste_y + egg1_h - int(nest_new_h * 0.85) 
    out_nest.paste(nest_resized, (nest_x, nest_y))
    out_nest.save('assets/dragons/stage2_nest_padded.png')
    print("Saved scaled nest")
except Exception as e:
    print("Error with nest:", e)
