all:
	rm -f account-colors.zip
	7z a account-colors.zip api/ background.js chrome/ defaults/ LICENSE manifest.json README.md
	mv account-colors.zip account-colors.xpi
