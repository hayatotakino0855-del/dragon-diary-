import os
from PIL import Image
from rembg import remove

source_dir = 'C:/Users/User/.gemini/antigravity/brain/b9fa9caf-1a4e-408d-9ee3-34abb61094e0/'
dest_dir = 'c:/Users/User/OneDrive/デスクトップ/日記/assets/ui/'

prefixes = ['badge_streak_3', 'badge_streak_7', 'badge_streak_30', 'badge_lv2', 'badge_lv3', 'badge_lv4', 'badge_lv5', 'badge_lv7']

for filename in os.listdir(source_dir):
    for prefix in prefixes:
        if filename.startswith(prefix) and filename.endswith('.png'):
            src_path = os.path.join(source_dir, filename)
            dest_path = os.path.join(dest_dir, f"{prefix}.png")
            
            print(f"Processing {filename} -> {prefix}.png")
            
            try:
                # Open image
                img = Image.open(src_path).convert('RGBA')
                
                # Remove background
                no_bg = remove(img)
                
                # Get bounds for cropping
                data = no_bg.getdata()
                w = no_bg.width
                h = no_bg.height
                min_y = h
                max_y = 0
                min_x = w
                max_x = 0
                for y in range(h):
                    for x in range(w):
                        if data[y*w+x][3] > 10: # threshold for alpha
                            min_y = min(min_y, y)
                            max_y = max(max_y, y)
                            min_x = min(min_x, x)
                            max_x = max(max_x, x)
                            
                # Check if we got valid bounds
                if max_x >= min_x and max_y >= min_y:
                    cropped = no_bg.crop((min_x, min_y, max_x, max_y))
                    
                    # Make it square by adding padding if necessary to maintain aspect ratio
                    cw = max_x - min_x
                    ch = max_y - min_y
                    size = max(cw, ch)
                    
                    final_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
                    offset_x = (size - cw) // 2
                    offset_y = (size - ch) // 2
                    final_img.paste(cropped, (offset_x, offset_y))
                    
                    # Save to destination
                    final_img.save(dest_path)
                    print(f"Saved {dest_path}")
                else:
                    print(f"Failed to find valid bounds for {filename}")
            except Exception as e:
                print(f"Error processing {filename}: {e}")
