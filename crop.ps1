$source = @"
using System;
using System.Drawing;

public class ImageUtils {
    public static void Process(string imgPath, string outDir) {
        using (Image img = Image.FromFile(imgPath))
        using (Bitmap bmp = new Bitmap(img)) {
            Color bgColor = bmp.GetPixel(0,0);
            int minX = bmp.Width, minY = bmp.Height, maxX = 0, maxY = 0;
            
            for (int y = 0; y < bmp.Height; y++) {
                for (int x = 0; x < bmp.Width; x++) {
                    Color c = bmp.GetPixel(x, y);
                    int diff = Math.Abs(c.R - bgColor.R) + Math.Abs(c.G - bgColor.G) + Math.Abs(c.B - bgColor.B);
                    if (diff > 40) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (minX >= maxX || minY >= maxY) { minX = 0; minY = 0; maxX = bmp.Width-1; maxY = bmp.Height-1; }
            
            int cropW = maxX - minX + 1;
            int cropH = maxY - minY + 1;
            int maxSize = Math.Max(cropW, cropH);
            int pad = (int)(maxSize * 0.02);
            int paddedSize = maxSize + pad * 2;
            
            int[] sizes = { 16, 32, 48, 128 };
            foreach(int size in sizes) {
                using (Bitmap outBmp = new Bitmap(size, size)) {
                    using (Graphics g = Graphics.FromImage(outBmp)) {
                        g.Clear(Color.Transparent);
                        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                        g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                        
                        float scale = (float)size / paddedSize;
                        float destW = cropW * scale;
                        float destH = cropH * scale;
                        float destX = (size - destW) / 2;
                        float destY = (size - destH) / 2;
                        
                        RectangleF destRect = new RectangleF(destX, destY, destW, destH);
                        RectangleF srcRect = new RectangleF(minX, minY, cropW, cropH);
                        
                        g.DrawImage(bmp, destRect, srcRect, GraphicsUnit.Pixel);
                    }
                    
                    for (int y = 0; y < outBmp.Height; y++) {
                        for (int x = 0; x < outBmp.Width; x++) {
                            Color c = outBmp.GetPixel(x, y);
                            if (c.A > 0) {
                                int diff = Math.Abs(c.R - bgColor.R) + Math.Abs(c.G - bgColor.G) + Math.Abs(c.B - bgColor.B);
                                if (diff < 40) {
                                    outBmp.SetPixel(x, y, Color.Transparent);
                                } else if (diff < 80) {
                                    int alpha = (diff - 40) * 255 / 40;
                                    outBmp.SetPixel(x, y, Color.FromArgb(alpha, c.R, c.G, c.B));
                                }
                            }
                        }
                    }
                    outBmp.Save(outDir + "\\icon" + size + ".png", System.Drawing.Imaging.ImageFormat.Png);
                }
            }
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies "System.Drawing"
[ImageUtils]::Process("C:\Users\aozka\.gemini\antigravity\brain\86ea5766-5445-468c-9295-e49a148787bd\hype_logo_no_text_1777245582178.png", "C:\Users\aozka\CascadeProjects\LiveScoreFootball\extension\icons")
Write-Host "Transparent crop and resize completed."
