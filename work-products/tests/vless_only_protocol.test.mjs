import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminSource = await readFile(new URL('../../admin/index.html', import.meta.url), 'utf8');

test('管理页不再提供 Trojan 节点协议', () => {
	assert.equal(/trojan/i.test(adminSource), false);
	assert.match(adminSource, /<option value="vless">VLESS<\/option>/);
});
