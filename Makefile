# Cleanup
clean_vscode:
	rm -rf .vscode

clean: clean_vscode

# Testing
test:
	python -m SimpleHTTPServer

# Pwny
.PHONY: clean clean_vscode \
test
