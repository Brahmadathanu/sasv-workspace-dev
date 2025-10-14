# Malayalam Font Setup

## Required Font Files

To enable proper Malayalam text rendering in PDFs, you need to add the Anek Malayalam font files to the `css/fonts/` directory.

### Download Anek Malayalam Font

1. Visit [Google Fonts - Anek Malayalam](https://fonts.google.com/specimen/Anek+Malayalam)
2. Click "Download family" to get the font files
3. Extract the downloaded ZIP file

### Required Font Files

Place the following TTF files in `css/fonts/` directory (TTF files work perfectly fine):

- `AnekMalayalam-Regular.ttf`
- `AnekMalayalam-Bold.ttf`
- `AnekMalayalam-Medium.ttf`

**Note:** The system is configured to use TTF files directly. WOFF and WOFF2 formats are optional optimizations but not required.

### File Structure

After adding the fonts, your directory structure should look like:

```
css/
├── fonts.css
├── fonts/
│   ├── AnekMalayalam-Regular.ttf
│   ├── AnekMalayalam-Bold.ttf
│   └── AnekMalayalam-Medium.ttf
```

### Converting Font Files (Optional)

If you only have TTF files, you can convert them to WOFF and WOFF2 formats using:

- [CloudConvert](https://cloudconvert.com/ttf-to-woff2)
- [Font Squirrel Webfont Generator](https://www.fontsquirrel.com/tools/webfont-generator)
- [Google's woff2 tools](https://github.com/google/woff2)

### Fallback Fonts

The system is configured with fallback fonts in case Anek Malayalam is not available:

- Noto Sans Malayalam (system font)
- Manjari (system font)
- Rachana (system font)
- System default sans-serif

### Usage

Once the fonts are properly installed:

1. Malayalam PDFs will automatically use the Anek Malayalam font
2. Text will render with proper Malayalam Unicode characters
3. No code changes are required - the system will detect and use the font automatically

### Verification

To verify the font is working:

1. Generate a Malayalam PDF from the Supply Batch Plan
2. Check that Malayalam text renders clearly without garbled characters
3. The font should appear clean and readable in the downloaded PDF

### Troubleshooting

If Malayalam text still appears garbled:

1. Ensure all font files are in the correct `css/fonts/` directory
2. Clear browser cache and reload the page
3. Check browser developer tools for any font loading errors
4. Verify the font files are not corrupted by testing them locally
