.PHONY: help install dev build preview test lint bench clean

help:
	@echo "ascgen2 — available targets:"
	@echo "  make install   Install dependencies with pnpm"
	@echo "  make dev       Start the dev server at http://localhost:4321"
	@echo "  make build     Production build to dist/"
	@echo "  make preview   Preview the production build locally"
	@echo "  make test      Run the Vitest test suite once"
	@echo "  make lint      Run ESLint over src/"
	@echo "  make bench     Run the Vitest benchmark suite"
	@echo "  make clean     Remove node_modules and dist/"

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

preview:
	pnpm preview

test:
	pnpm test

lint:
	pnpm lint

bench:
	pnpm exec vitest bench --run

clean:
	rm -rf node_modules dist
