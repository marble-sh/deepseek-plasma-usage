# DeepSeek 用量 — 一个 Plasma 6 小部件

- 🇬🇧/🇺🇸 [![English](https://img.shields.io/badge/Language-English-blue)](README.md)
- 🇮🇳 [![हिन्दी](https://img.shields.io/badge/Language-हिन्दी-FF9933)](README.hi-IN.md)
- 🇮🇩 [![Bahasa Indonesia](https://img.shields.io/badge/Language-Bahasa%20Indonesia-CE1126)](README.id-ID.md)
- 🇫🇷 [![Français](https://img.shields.io/badge/Language-Français-0055A4)](README.fr-FR.md)
- 🇷🇺 [![Русский](https://img.shields.io/badge/Language-Русский-0039A6)](README.ru-RU.md)
- 🇪🇸 [![Español](https://img.shields.io/badge/Language-Español-F1BF00)](README.es-ES.md)

> [!NOTE]
> 本文件是英文 README 的机器翻译，尚未经过母语者审阅。英文版 `README.md` 为权威版本，翻译政策见 `translate/README.md`。

一个小巧、无依赖的 KDE Plasma 6 小程序，在面板中显示你的 DeepSeek API
余额和用量，并带有一个详细的弹窗。

- **面板：** 一个图标加上你选择的数字（余额、今日支出、今日 tokens、
  周期支出或累计支出）。
- **弹窗：** 余额、今日/周期/累计支出、估算的"剩余天数"、
  输入/输出/缓存 tokens 和请求次数、每日支出迷你图，以及
  按 API 密钥细分的明细。
- **密钥存放在 KWallet 中**，绝不写入小部件的配置文件。
- 除 Plasma 和 Qt 外**没有运行时依赖**：网络访问使用 QML
  `XMLHttpRequest`，解析使用纯 JavaScript，KWallet 通过
  `kwallet-query` 访问。

![丰富模式](docs/images/rich-mode.zh-CN.png)

作为面板徽标——图标、你选择的数字，以及高峰/非高峰圆点：

![面板徽标](docs/images/panel-mode.png)

## 安装

```sh
./install.sh            # install or upgrade for the current user
./install.sh --pack     # write deepseek-usage.plasmoid for distribution
./install.sh --uninstall
```

然后将 **DeepSeek Usage** 添加到面板或桌面。右键点击小部件 →
_配置…_ 以添加你的凭据。

## 凭据

存在两种不同的凭据，它们不能互换使用。

|          | API 密钥                                 | 会话令牌                                        |
| -------- | ---------------------------------------- | ----------------------------------------------- |
| 获取方式 | <https://platform.deepseek.com/api_keys> | 你登录后平台网站保留的值                        |
| 权限范围 | 你账户的 API 访问权限                    | **完整的账户访问权限**，包括创建和删除 API 密钥 |
| 提供内容 | 仅余额                                   | 余额、累计支出和用量历史                        |
| 存储为   | KWallet 中的 `deepseek-api-key`          | KWallet 中的 `deepseek-session-token`           |

两者都会写入 KWallet（钱包 `kdewallet`，文件夹 `Plasma`），并通过
`kwallet-query` 读回。仅凭 API 密钥就足以获取余额；添加
会话令牌后会启用用量相关区块。如果会话令牌失效，
小部件会回退到余额，并告诉你原因。

> [!WARNING]
> 会话令牌的权限等同于你的密码。请像对待密码一样对待它，如果你
> 不再使用丰富模式，请将其从 KWallet 中删除。

## 数据来源

该小部件是一个混合体，因为 DeepSeek 提供了两个互不相关的 API。

**官方 API**（`api.deepseek.com`）—— 使用 API 密钥认证，有文档、
可靠，但它只报告余额：

```
GET https://api.deepseek.com/user/balance
Authorization: Bearer <API_KEY>
```

**平台 API**（`platform.deepseek.com/api/v0`）—— 网页用量页面背后的后端。
它使用会话认证且**没有文档**，因此随时可能
发生变化：

```
GET /users/get_user_summary
GET /usage/by_api_key/amount?start=&end=&tz=
GET /usage/by_api_key/cost?start=&end=&tz=
authorization: Bearer <SESSION_TOKEN>
```

有两点值得了解的特性：

- 平台 API **即使认证失败也会返回 HTTP 200**，把真实状态放在
  JSON 正文中（`{"code":40003,...}`）。因此小部件根据响应负载
  而非 HTTP 状态码来判断结果。
- 费用和 token 负载对其序列的嵌套方式不同（费用为
  `data.biz_data.data[].series[]`，tokens 为 `data.biz_data.series[]`）。

由于没有文档化的"用量"端点，支出数字和
"预计剩余天数"数值都是**由此 API 推导**出来的，并在弹窗中
如此标注。

## 配置

| 设置         | 默认值 | 含义                       |
| ------------ | ------ | -------------------------- |
| 刷新间隔     | 300 秒 | 轮询频率（最小 30 秒）     |
| 面板显示     | 余额   | 面板中显示哪个数字         |
| 费用周期     | 30 天  | 周期总计和迷你图的时间窗口 |
| 隐藏所有金额 | 关闭   | 将屏幕上每个金额替换为圆点 |

按密钥细分的列表只列出 API 密钥的**名称**。平台报告的
掩码密钥 id 有意完全不渲染到任何地方。

## 高峰与非高峰定价

DeepSeek 在高峰时段之外按半价收费，因此小部件会显示当前
生效的费率：面板徽标上的一个小圆点，以及弹窗和工具提示中
的状态和剩余时间。

- **绿色** —— 非高峰：你支付的是折扣价
- **红色** —— 高峰：你支付的是全价
- **中性色** —— 未知：见下文

该时间表在[文档](https://api-docs.deepseek.com/quick_start/pricing)中被描述为
_周一至周五 01:00–04:00 和 06:00–10:00 UTC，中国法定节假日除外_；
其余所有时间都是非高峰，包括周末和节假日的全部时段。

### 为什么会显示"未知"

该规则中的星期和时刻部分是精确的，始终适用。节假日
例外则不同：国务院只在 11 月或 12 月公布次年的日期，而且
可能修订，所以这是必须手动维护、无法推导的数据。

因此小部件不会进行猜测。`contents/ui/js/peak.js` 中的
`CHINESE_HOLIDAYS` 按区块保存了已公布年份的官方时间表：

```js
addRange("2026-10-01", "2026-10-07"); // National Day
```

当被问到表格未覆盖的年份时，状态会报告为
**未知**，而不是假定那些日子是普通工作日——那样假定
会在 DeepSeek 实际按非高峰费率收费时报告为高峰。同样不允许
添加估算的日期，原因在相反方向上相同：错误的条目会
声称存在一个并不存在的折扣。

### 保持更新

`node --test tests/peak.test.mjs` 包含一个刻意的维护警报：它
**一旦表格不再覆盖当前年份就会失败**，并且如果任何已覆盖的
年份看起来只填了一半也会失败。用 `addRange()` 添加新公布的
年份，测试就会重新变绿。日期在 11 月/12 月为次年公布，
所以这是每年一次的事务。

## 开发

解析、格式化和 KWallet 命令逻辑位于 `contents/ui/js/` 下的纯 JavaScript
模块中，因此无需 Plasma 会话即可测试：

```sh
node --test tests/api.test.mjs tests/format.test.mjs tests/wallet.test.mjs
```

`tests/mock-platform-server.mjs` 提供平台 API 录制下来的负载结构，
这是在没有真实凭据的情况下演练丰富模式的唯一方式。测试时把
`contents/ui/js/api.js` 中的 `PLATFORM_BASE` 指向
`http://127.0.0.1:8731/api/v0`，测试完再改回来。

QML 方面的静态检查：

```sh
qmllint contents/ui/*.qml contents/config/config.qml
```

按语言区域各渲染一次小程序，以发现乱码或溢出
弹窗的文本（印地语和俄语比英语长得多）：

```sh
tests/capture-locales.sh /tmp/shots zh_CN ru_RU hi_IN
```

### 持续集成

上述检查在 CI（`.github/workflows/ci.yml`）中运行，使用标准的 Ubuntu
运行器且不需要 Plasma：`node --test`、`./translate/build.sh --check`、
用 `qmllint` 做的 QML 语法检查，以及 `./install.sh --pack` 以证明
分发包仍然可以构建。Qt 6 上的 `qmllint` 不解析任何导入，因此
不需要 KDE 软件包，这正是该任务得以成立的原因。

有一个工作流不在推送时运行。`.github/workflows/holiday-alarm.yml` 在
每月一号运行 `tests/peak.test.mjs`，因为该文件包含一个
刻意的警报：一旦中国节假日表格不再覆盖当前年份它就会失败，
而国务院只在 11 月或 12 月公布次年的日期。那里的一次红色
运行是提醒你用 `addRange()` 添加已公布的区块，而不是 bug。

## 翻译

该小部件附带 17 个语言目录：简体中文、英语（印度）、印地语、
印度尼西亚语、法语、俄语（俄罗斯和白俄罗斯）、西班牙语（西班牙和四种
拉丁美洲变体），以及用于拓宽 Qt 语言区域回退的裸语言别名。翻译位于
`translate/` 中；工作流程和表格格式见
[`translate/README.md`](translate/README.md)。

本 README 也已被翻译；页面顶部的语言链接
指向这些文件。它们是**本文档的机器翻译，每种语言只保留
一个文件**——区域目录变体（`en_IN`、`ru_BY`、
`es_419` 以及四个拉丁美洲西班牙语代码）共享其语言的
README，而不是重复一份。

```sh
./translate/merge.sh          # re-extract template.pot after changing i18n() calls
./translate/build.sh          # regenerate .po and compile .mo
./translate/build.sh --check  # CI: fail if any catalogue is out of date
```

> [!WARNING]
> **每个语言目录都是机器生成的，从未经过母语者审阅。** 每个 `.po`
> 都在其头部记录了这一点，其 `Language-Team` 字段仍是 gettext 的
> "尚无目录被认领"占位符。请把它们当作起点，而不是
> 已完成的翻译。
>
> **优先审阅：印地语、俄语和简体中文**——这个小部件最可能被使用的
> 语言，也是未经审阅的翻译最不可接受的语言。其余的都算
> 额外收获。

解决这个问题的既定路线是 **KDE 自己的翻译团队**（决策 D13）：这是
唯一能产出由真正使用该语言的人所做的*经过审阅*的翻译的途径。
仓库根目录的 `Messages.sh` 已经是 KDE 工具链所期望的入口点，而
`translate/README.md` 列出了具体步骤——主要前提是该小部件必须位于
某个 KDE 仓库中，团队才能接手。Crowdin/Transifex 配置只作为后备
保留，并明确标注为从未运行过。

## 许可证

GPL-2.0-or-later。见 `LICENSE`。
