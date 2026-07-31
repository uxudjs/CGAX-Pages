import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../admin/index.html', import.meta.url), 'utf8');

test('管理页提供四项连接设置，并保留各自的最小值', () => {
	assert.match(source, /id="preloadRaceDial"/);
	assert.match(source, /id="tcpConcurrentDial" min="1"/);
	assert.match(source, /id="proxyConcurrentDial" min="1"/);
	assert.match(source, /id="keepaliveInterval" min="1000"/);
});

test('连接设置的开关不会被模块通用输入布局拉伸', () => {
	assert.match(source, /\.connection-settings \.(?:checkbox-group )?input\[type="checkbox"\]\s*\{[\s\S]*?flex:\s*0 0 18px/);
});

test('管理页回填、校验并保存连接设置', () => {
	assert.match(source, /const connectionSettings = currentConfig\.连接设置 \|\| \{\};/);
	assert.match(source, /currentConfig\.连接设置 = \{/);
	assert.match(source, /连接保活间隔毫秒: keepaliveInterval/);
	assert.match(source, /keepaliveInterval < 1000/);
});
