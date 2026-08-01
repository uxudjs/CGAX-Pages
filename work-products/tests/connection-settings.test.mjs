import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../admin/index.html', import.meta.url), 'utf8');

function createSaveConfigHarness({ initialConfig, editedConfig, responseOk }) {
	const match = source.match(/async function saveConfigToServer\(section\) \{[\s\S]*?\r?\n\t\t\}(?=\r?\n\r?\n\t\tfunction cancelEdit)/);
	assert.ok(match, '应能提取 saveConfigToServer');

	return Function('initialConfig', 'editedConfig', 'responseOk', `
		let originalConfig = structuredClone(initialConfig);
		let currentConfig = structuredClone(editedConfig);
		const fetch = async () => ({ ok: responseOk });
		const showToast = () => {};
		const modifiedSections = new Set(['proxy']);
		const updateButtonStates = () => {};
		${match[0]}
		return {
			save: () => saveConfigToServer('proxy'),
			getOriginalConfig: () => originalConfig
		};
	`)(initialConfig, editedConfig, responseOk);
}

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

test('管理页提供五种连接场景与四组精确预设', () => {
	assert.match(source, /<label for="connectionProfile">使用场景<\/label>/);
	assert.match(source, /<select id="connectionProfile"[\s\S]*?<option value="balanced">网页\/视频（均衡）<\/option>[\s\S]*?<option value="long_lived">WS\/gRPC 长连接<\/option>[\s\S]*?<option value="weak_network">弱网快速建连<\/option>[\s\S]*?<option value="resource_saver">节省连接资源<\/option>[\s\S]*?<option value="custom">自定义<\/option>[\s\S]*?<\/select>/);
	assert.match(source, /balanced:\s*Object\.freeze\(\{ preloadRaceDial: false, tcpConcurrentDial: 2, proxyConcurrentDial: 1, keepaliveInterval: 30000/);
	assert.match(source, /long_lived:\s*Object\.freeze\(\{ preloadRaceDial: false, tcpConcurrentDial: 2, proxyConcurrentDial: 1, keepaliveInterval: 15000/);
	assert.match(source, /weak_network:\s*Object\.freeze\(\{ preloadRaceDial: true, tcpConcurrentDial: 3, proxyConcurrentDial: 2, keepaliveInterval: 30000/);
	assert.match(source, /resource_saver:\s*Object\.freeze\(\{ preloadRaceDial: false, tcpConcurrentDial: 1, proxyConcurrentDial: 1, keepaliveInterval: 60000/);
});

test('连接场景可填充、读取并按四项值精确回推', () => {
	assert.match(source, /function readConnectionSettingsForm\(\)/);
	assert.match(source, /function applyConnectionProfile\(profileId\)/);
	assert.match(source, /function inferConnectionProfile\(settings\)/);
	assert.match(source, /function syncConnectionProfileSelection\(\)/);
	assert.match(source, /onchange="handleConnectionSettingChange\(\)"/);
	assert.match(source, /applyProxyConfigToForm\(\)[\s\S]*?syncConnectionProfileSelection\(\);/);
	assert.match(source, /await saveConfigToServer\('proxy'\);\s*syncConnectionProfileSelection\(\);/);
});

test('选择自定义不写值，并固定展示适用边界', () => {
	assert.match(source, /if \(profileId === 'custom'\) \{\s*updateConnectionProfileDescription\(profileId\);\s*return;\s*\}/);
	assert.match(source, /环境变量存在时优先，可能覆盖此处保存值/);
	assert.match(source, /设置只影响新建连接，现有长连接需重连/);
	assert.match(source, /竞速主要影响建连与失败切换，不直接提高视频吞吐/);
	assert.match(source, /WS\/gRPC 长连接预设的保活值不作用于 XHTTP/);
});

test('保存成功后更新取消基线，保存失败时保留旧基线', async () => {
	const initialConfig = { 连接设置: { 连接保活间隔毫秒: 30000 } };
	const editedConfig = { 连接设置: { 连接保活间隔毫秒: 15000 } };
	const successfulSave = createSaveConfigHarness({ initialConfig, editedConfig, responseOk: true });
	await successfulSave.save();
	assert.deepEqual(successfulSave.getOriginalConfig(), editedConfig);

	const failedSave = createSaveConfigHarness({ initialConfig, editedConfig, responseOk: false });
	await failedSave.save();
	assert.deepEqual(failedSave.getOriginalConfig(), initialConfig);
});
