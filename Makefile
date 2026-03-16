all:
	rm -f accountcolors.xpi
	zip -r accountcolors.xpi api/ background.js icons/ _locales/ LICENSE manifest.json modules/ options/ README.md
