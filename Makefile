all:
	rm -f accountcolors.zip
	7z a accountcolors.zip api/ background.js chrome/ defaults/ LICENSE manifest.json README.md
	mv accountcolors.zip accountcolors.xpi
