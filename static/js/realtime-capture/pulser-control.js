// ==================== 脉冲发生器控制模块 ====================
// 负责脉冲发生器的连接、参数设置、状态管理

const PulserControl = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let elements = {};
    let 已连接 = false;
    let 当前端口 = null;
    let 当前脉宽倍数 = 1;  // 1-40
    let 当前增益 = 30;     // 0-60
    
    // ========== 初始化 ==========
    function 初始化() {
        console.log('[脉冲控制] 初始化模块...');
        
        // 获取DOM元素
        elements = {
            sectionTitle: document.getElementById('pulserSectionTitle'),
            toggleIcon: document.getElementById('pulserToggleIcon'),
            controlPanel: document.getElementById('pulserControlPanel'),
            deviceSelect: document.getElementById('pulserDeviceSelect'),
            connectBtn: document.getElementById('pulserConnectBtn'),
            pulseWidthSlider: document.getElementById('pulseWidthSlider'),
            pulseWidthValue: document.getElementById('pulseWidthValue'),
            pulseWidthUp: document.getElementById('pulseWidthUp'),
            pulseWidthDown: document.getElementById('pulseWidthDown'),
            prfSelect: document.getElementById('pulserPrfSelect'),
            gainSlider: document.getElementById('pulserGainSlider'),
            gainValue: document.getElementById('pulserGainValue'),
            gainUp: document.getElementById('pulserGainUp'),
            gainDown: document.getElementById('pulserGainDown')
        };
        
        // 绑定事件
        绑定事件();
        
        // 搜索设备
        搜索设备();
        
        console.log('[脉冲控制] 初始化完成');
    }
    
    function 绑定事件() {
        elements.sectionTitle.addEventListener('click', 切换面板);
        elements.connectBtn.addEventListener('click', 处理连接按钮);
        
        // 脉冲宽度：滑块 + 按钮
        elements.pulseWidthSlider.addEventListener('input', () => {
            当前脉宽倍数 = parseInt(elements.pulseWidthSlider.value);
            更新脉宽显示();
        });
        elements.pulseWidthSlider.addEventListener('change', () => 实时应用参数('脉冲宽度', 当前脉宽倍数));
        elements.pulseWidthUp.addEventListener('click', () => 调整脉宽(1));
        elements.pulseWidthDown.addEventListener('click', () => 调整脉宽(-1));
        
        // 增益：滑块 + 按钮
        elements.gainSlider.addEventListener('input', () => {
            当前增益 = parseInt(elements.gainSlider.value);
            更新增益显示();
        });
        elements.gainSlider.addEventListener('change', () => 实时应用参数('增益', 当前增益));
        elements.gainUp.addEventListener('click', () => 调整增益(1));
        elements.gainDown.addEventListener('click', () => 调整增益(-1));
        
        // 重复频率下拉框
        elements.prfSelect.addEventListener('change', (e) => 实时应用参数('重复频率', e.target.value));
        
        // 为所有单选按钮添加实时应用事件
        document.querySelectorAll('input[name="pulserVoltage"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                应用硬件保护规则();
                实时应用参数('发射电压', e.target.value);
            });
        });
        document.querySelectorAll('input[name="pulserTrigger"]').forEach(radio => {
            radio.addEventListener('change', (e) => 实时应用参数('触发源', e.target.value));
        });
        document.querySelectorAll('input[name="pulserCrystal"]').forEach(radio => {
            radio.addEventListener('change', (e) => 实时应用参数('单双晶模式', e.target.value));
        });
        document.querySelectorAll('input[name="pulserDamping"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                应用硬件保护规则();
                实时应用参数('阻尼', e.target.value);
            });
        });
    }
    
    // ========== 硬件保护规则 ==========
    function 应用硬件保护规则() {
        const 阻尼值 = parseInt(document.querySelector('input[name="pulserDamping"]:checked')?.value || 1);
        const 电压值 = parseInt(document.querySelector('input[name="pulserVoltage"]:checked')?.value || 1);
        
        // 规则1: 根据阻尼限制发射电压
        document.querySelectorAll('input[name="pulserVoltage"]').forEach(radio => {
            const voltage = parseInt(radio.value);
            let disabled = false;
            let reason = '';
            
            if (阻尼值 === 0) {  // 34Ω
                if (voltage === 7 || voltage === 8) {  // 350V, 400V
                    disabled = true;
                    reason = '阻尼34Ω时不可选350V/400V';
                }
            } else if (阻尼值 === 1 || 阻尼值 === 2) {  // 50Ω, 90Ω
                if (voltage === 8) {  // 400V
                    disabled = true;
                    reason = '阻尼50Ω/90Ω时不可选400V';
                }
            }
            
            radio.disabled = disabled;
            radio.parentElement.style.opacity = disabled ? '0.5' : '1';
            radio.parentElement.style.cursor = disabled ? 'not-allowed' : 'pointer';
            radio.parentElement.title = disabled ? reason : '';
            
            // 如果当前选中的电压被禁用，自动切换到60V
            if (disabled && radio.checked) {
                document.querySelector('input[name="pulserVoltage"][value="1"]').checked = true;
                显示状态栏信息('⚠️', '参数已调整', reason + '，已自动切换到60V', 'warning', 4000);
            }
        });
        
        // 规则2: 根据阻尼和电压限制脉冲宽度
        let 最大脉宽 = 40;
        let 限制原因 = '';
        
        if (阻尼值 === 3 && 电压值 === 8) {  // 510Ω + 400V
            最大脉宽 = 10;
            限制原因 = '阻尼510Ω + 400V时，脉冲宽度限制为1-10倍';
        } else if ((阻尼值 === 1 || 阻尼值 === 2) && 电压值 === 7) {  // 50Ω/90Ω + 350V
            最大脉宽 = 10;
            限制原因 = '阻尼50Ω/90Ω + 350V时，脉冲宽度限制为1-10倍';
        }
        
        // 如果当前脉宽超过限制，自动调整
        if (当前脉宽倍数 > 最大脉宽) {
            当前脉宽倍数 = 最大脉宽;
            更新脉宽显示();
            if (限制原因) {
                显示状态栏信息('⚠️', '参数已调整', 限制原因, 'warning', 4000);
            }
        } else {
            // 只更新按钮状态
            更新脉宽显示();
        }
    }
    
    // ========== 状态栏信息显示 ==========
    function 显示状态栏信息(图标, 主文本, 详细文本 = '', 类型 = 'success', 持续时间 = 3000) {
        const statusBarInfoPanel = document.getElementById('statusBarInfoPanel');
        const statusBarInfoIcon = document.getElementById('statusBarInfoIcon');
        const statusBarInfoText = document.getElementById('statusBarInfoText');
        const statusBarInfoDetail = document.getElementById('statusBarInfoDetail');
        
        if (!statusBarInfoPanel) return;
        
        // 设置图标和文本
        statusBarInfoIcon.textContent = 图标;
        statusBarInfoText.textContent = 主文本;
        
        // 设置详细信息（如果有）
        if (详细文本) {
            statusBarInfoDetail.textContent = 详细文本;
            statusBarInfoDetail.style.display = 'block';
        } else {
            statusBarInfoDetail.style.display = 'none';
        }
        
        // 移除所有类型类
        statusBarInfoPanel.classList.remove('success', 'info', 'warning', 'error');
        
        // 添加对应类型的类
        statusBarInfoPanel.classList.add(类型);
        
        // 显示面板
        statusBarInfoPanel.style.display = 'flex';
        
        // 指定时间后自动隐藏
        setTimeout(() => {
            statusBarInfoPanel.style.display = 'none';
        }, 持续时间);
    }
    
    // ========== 界面控制 ==========
    function 切换面板() {
        const isVisible = elements.controlPanel.style.display !== 'none';
        elements.controlPanel.style.display = isVisible ? 'none' : 'block';
        elements.toggleIcon.textContent = isVisible ? '▶' : '▼';
    }
    
    function 调整脉宽(delta) {
        if (!已连接) {
            显示状态栏信息('⚠️', '请先连接设备', '', 'warning', 2000);
            return;
        }
        
        // 获取当前最大值（可能受硬件保护限制）
        const 阻尼值 = parseInt(document.querySelector('input[name="pulserDamping"]:checked')?.value || 1);
        const 电压值 = parseInt(document.querySelector('input[name="pulserVoltage"]:checked')?.value || 1);
        
        let 最大脉宽 = 40;
        if (阻尼值 === 3 && 电压值 === 8) {
            最大脉宽 = 10;
        } else if ((阻尼值 === 1 || 阻尼值 === 2) && 电压值 === 7) {
            最大脉宽 = 10;
        }
        
        // 计算新值
        let 新值 = 当前脉宽倍数 + delta;
        
        // 限制范围
        if (新值 < 1) 新值 = 1;
        if (新值 > 最大脉宽) 新值 = 最大脉宽;
        
        // 如果值没变，不做任何操作
        if (新值 === 当前脉宽倍数) return;
        
        当前脉宽倍数 = 新值;
        更新脉宽显示();
        实时应用参数('脉冲宽度', 当前脉宽倍数);
    }
    
    function 调整增益(delta) {
        if (!已连接) {
            显示状态栏信息('⚠️', '请先连接设备', '', 'warning', 2000);
            return;
        }
        
        // 计算新值
        let 新值 = 当前增益 + delta;
        
        // 限制范围
        if (新值 < 0) 新值 = 0;
        if (新值 > 60) 新值 = 60;
        
        // 如果值没变，不做任何操作
        if (新值 === 当前增益) return;
        
        当前增益 = 新值;
        更新增益显示();
        实时应用参数('增益', 当前增益);
    }
    
    function 更新脉宽显示() {
        const actualNs = 当前脉宽倍数 * 28;  // 1倍约28ns
        elements.pulseWidthValue.textContent = `${actualNs} ns`;
        
        // 同步滑块位置
        elements.pulseWidthSlider.value = 当前脉宽倍数;
        
        // 更新按钮状态
        const 阻尼值 = parseInt(document.querySelector('input[name="pulserDamping"]:checked')?.value || 1);
        const 电压值 = parseInt(document.querySelector('input[name="pulserVoltage"]:checked')?.value || 1);
        
        let 最大脉宽 = 40;
        if (阻尼值 === 3 && 电压值 === 8) {
            最大脉宽 = 10;
        } else if ((阻尼值 === 1 || 阻尼值 === 2) && 电压值 === 7) {
            最大脉宽 = 10;
        }
        
        // 更新滑块最大值
        elements.pulseWidthSlider.max = 最大脉宽;
        
        elements.pulseWidthUp.disabled = 当前脉宽倍数 >= 最大脉宽;
        elements.pulseWidthDown.disabled = 当前脉宽倍数 <= 1;
    }
    
    function 更新增益显示() {
        elements.gainValue.textContent = `${当前增益} dB`;
        
        // 同步滑块位置
        elements.gainSlider.value = 当前增益;
        
        // 更新按钮状态
        elements.gainUp.disabled = 当前增益 >= 60;
        elements.gainDown.disabled = 当前增益 <= 0;
    }
    
    // ========== 设备管理 ==========
    async function 搜索设备() {
        try {
            const result = await pywebview.api.搜索脉冲发生器设备();
            
            if (result.success && result.ports && result.ports.length > 0) {
                // 更新设备列表
                elements.deviceSelect.innerHTML = '<option value="">请选择设备</option>';
                result.ports.forEach(port => {
                    const option = document.createElement('option');
                    option.value = port;
                    option.textContent = `COM${port}`;
                    elements.deviceSelect.appendChild(option);
                });
                
                console.log(`[脉冲控制] 检测到 ${result.ports.length} 个设备`);
            } else {
                elements.deviceSelect.innerHTML = '<option value="">未检测到设备</option>';
                console.log('[脉冲控制] 未检测到设备');
            }
        } catch (error) {
            console.error('[脉冲控制] 搜索设备失败:', error);
            elements.deviceSelect.innerHTML = '<option value="">搜索失败</option>';
        }
    }
    
    async function 处理连接按钮() {
        if (已连接) {
            await 断开设备();
        } else {
            await 连接设备();
        }
    }
    
    async function 连接设备() {
        const port = parseInt(elements.deviceSelect.value);
        
        if (!port) {
            显示状态栏信息('⚠️', '请先选择设备', '', 'warning', 3000);
            return;
        }
        
        try {
            elements.connectBtn.disabled = true;
            elements.connectBtn.textContent = '连接中...';
            
            const result = await pywebview.api.连接脉冲发生器(port);
            
            if (result.success) {
                已连接 = true;
                当前端口 = port;
                elements.connectBtn.textContent = '断开';
                elements.connectBtn.classList.remove('btn-primary');
                elements.connectBtn.classList.add('btn-danger');
                elements.deviceSelect.disabled = true;
                
                // 加载当前参数
                await 加载参数();
                
                显示状态栏信息('✅', '连接成功', `已连接到 COM${port}`, 'success', 3000);
            } else {
                显示状态栏信息('❌', '连接失败', result.message, 'error', 4000);
            }
        } catch (error) {
            console.error('[脉冲控制] 连接失败:', error);
            显示状态栏信息('❌', '连接失败', error.toString(), 'error', 4000);
        } finally {
            elements.connectBtn.disabled = false;
            if (!已连接) {
                elements.connectBtn.textContent = '连接';
            }
        }
    }
    
    async function 断开设备() {
        try {
            elements.connectBtn.disabled = true;
            elements.connectBtn.textContent = '断开中...';
            
            const result = await pywebview.api.断开脉冲发生器();
            
            if (result.success) {
                已连接 = false;
                当前端口 = null;
                elements.connectBtn.textContent = '连接';
                elements.connectBtn.classList.remove('btn-danger');
                elements.connectBtn.classList.add('btn-primary');
                elements.deviceSelect.disabled = false;
                
                显示状态栏信息('✅', '已断开连接', '', 'success', 3000);
            } else {
                显示状态栏信息('❌', '断开失败', result.message, 'error', 4000);
            }
        } catch (error) {
            console.error('[脉冲控制] 断开失败:', error);
            显示状态栏信息('❌', '断开失败', error.toString(), 'error', 4000);
        } finally {
            elements.connectBtn.disabled = false;
            if (已连接) {
                elements.connectBtn.textContent = '断开';
            }
        }
    }
    
    // ========== 参数管理 ==========
    async function 实时应用参数(参数名, 值) {
        if (!已连接) {
            显示状态栏信息('⚠️', '请先连接设备', '', 'warning', 2000);
            return;
        }
        
        try {
            const intValue = parseInt(值);
            let result;
            
            switch(参数名) {
                case '发射电压':
                    result = await pywebview.api.设置脉冲发生器发射电压(intValue);
                    break;
                case '脉冲宽度':
                    result = await pywebview.api.设置脉冲发生器脉冲宽度(intValue);
                    break;
                case '重复频率':
                    result = await pywebview.api.设置脉冲发生器重复频率(intValue);
                    break;
                case '触发源':
                    result = await pywebview.api.设置脉冲发生器触发源(intValue);
                    break;
                case '单双晶模式':
                    result = await pywebview.api.设置脉冲发生器单双晶模式(intValue);
                    break;
                case '阻尼':
                    result = await pywebview.api.设置脉冲发生器阻尼(intValue);
                    // 阻尼改变后重新应用保护规则
                    if (result.success) {
                        应用硬件保护规则();
                    }
                    break;
                case '增益':
                    result = await pywebview.api.设置脉冲发生器增益(intValue);
                    break;
                default:
                    console.error('[脉冲控制] 未知参数:', 参数名);
                    return;
            }
            
            if (result.success) {
                console.log(`[脉冲控制] ${参数名}已设置为: ${值}`);
                
                // 显示后端返回的警告信息
                if (result.warnings && result.warnings.length > 0) {
                    显示状态栏信息('⚠️', '参数已设置', result.warnings.join('; '), 'warning', 4000);
                }
            } else {
                显示状态栏信息('❌', '设置失败', `${参数名}: ${result.message}`, 'error', 4000);
            }
        } catch (error) {
            console.error(`[脉冲控制] 设置${参数名}失败:`, error);
            显示状态栏信息('❌', '设置失败', error.toString(), 'error', 3000);
        }
    }
    
    async function 加载参数() {
        try {
            const result = await pywebview.api.获取脉冲发生器参数();
            
            if (result.success && result.data) {
                const data = result.data;
                
                // 设置发射参数
                const voltageRadio = document.querySelector(`input[name="pulserVoltage"][value="${data.voltage_index}"]`);
                if (voltageRadio) voltageRadio.checked = true;
                
                当前脉宽倍数 = data.pulse_width;
                更新脉宽显示();
                
                const prfIndex = 获取频率档位(data.prf);
                elements.prfSelect.value = String(prfIndex);
                
                const triggerRadio = document.querySelector(`input[name="pulserTrigger"][value="${data.trigger_source}"]`);
                if (triggerRadio) triggerRadio.checked = true;
                
                // 设置接收参数
                const crystalRadio = document.querySelector(`input[name="pulserCrystal"][value="${data.crystal_mode}"]`);
                if (crystalRadio) crystalRadio.checked = true;
                
                const dampingRadio = document.querySelector(`input[name="pulserDamping"][value="${data.damp_index}"]`);
                if (dampingRadio) dampingRadio.checked = true;
                
                当前增益 = data.gain;
                更新增益显示();
                
                // 🔧 加载参数后应用硬件保护规则
                应用硬件保护规则();
            }
        } catch (error) {
            console.error('[脉冲控制] 加载参数失败:', error);
        }
    }
    
    function 获取频率档位(prf) {
        // 频率值 -> 档位索引映射
        const 频率映射 = {
            4: 1, 8: 2, 16: 3, 20: 4,
            100: 5, 500: 6, 1000: 7, 2000: 8
        };
        return 频率映射[prf] || 4;
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        获取连接状态: () => 已连接,
        获取当前端口: () => 当前端口,
        搜索设备,
        断开设备
    };
})();
