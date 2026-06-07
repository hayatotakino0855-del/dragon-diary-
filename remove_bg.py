from PIL import Image
import os

def remove_white_bg(input_path, output_path, tolerance=240):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    new_data = []
    for item in datas:
        if item[0] >= tolerance and item[1] >= tolerance and item[2] >= tolerance:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)

    img.putdata(new_data)
    img.save(output_path, "PNG")

remove_white_bg('assets/dragons/ひびの卵.jpg', 'assets/dragons/stage2_egg_only.png')
remove_white_bg('assets/dragons/卵の藁.jpg', 'assets/dragons/stage2_nest.png')
print("Done processing new images")
