.PHONY: help install dev build preview test lint bench clean

help:
	@echo "ascgen2 — available targets:"
	@echo "  make install   Install npm dependencies"
	@echo "  make dev       Start the dev server at http://localhost:4321"
	@echo "  make build     Production build to dist/"
	@echo "  make preview   Preview the production build locally"
	@echo "  make test      Run the Vitest test suite once"
	@echo "  make lint      Run ESLint over src/"
	@echo "  make bench     Run the Vitest benchmark suite"
	@echo "  make clean     Remove node_modules and dist/"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

test:
	npm test

lint:
	npm run lint

bench:
	npx vitest bench --run

clean:
	rm -rf node_modules dist
