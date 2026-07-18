import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pagePaths = [
	'admin/index.html',
	'login/index.html',
	'noADMIN/index.html',
	'noKV/index.html'
];

const pages = Object.fromEntries(
	pagePaths.map(path => [path, readFileSync(new URL(path, import.meta.url), 'utf8')])
);

test('所有前端页面均尊重减少动态效果偏好', () => {
	for (const [path, source] of Object.entries(pages)) {
		assert.ok(/@media \(prefers-reduced-motion: reduce\)/.test(source), path);
	}
});

test('管理页不再运行启动性能探测器和不可达 UUID 动画', () => {
	const source = pages['admin/index.html'];
	assert.ok(!/measureAverageFrameTime|detectSoftwareRenderer|schedulePerformanceRecheck/.test(source));
	assert.ok(!/uuidSnippet|uuid-firework|uuid-gift-fx|uuid-rocket-fx/i.test(source));
});

test('页面不包含已确认的无限装饰动画', () => {
	for (const [path, source] of Object.entries(pages)) {
		assert.ok(
			!/(gradientShift|uuidSnippetGridDrift|uuidSnippetScan|uuidSnippetCoreSpin|uuidSnippetAuraPulse|uuidSnippetCoreFloat|uuidSnippetBeam|btnPulse|techScan|shake)\s+[^;\n]*infinite/i.test(source),
			path
		);
	}
});

test('用户模式切换不执行装饰性过场', () => {
	const source = pages['admin/index.html'];
	assert.doesNotMatch(source, /mode-transition|USER_MODE_TRANSITION|playUserModeTransition|createExpertMode/);
	assert.doesNotMatch(source, /void cardContainer\.offsetHeight/);
	assert.match(source, /\.simple-mode \.advanced-module\s*{[^}]*display:\s*none/s);
});
