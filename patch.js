const fs = require('fs');

const i18nPath = 'src/lib/i18n.ts';
let i18nContent = fs.readFileSync(i18nPath, 'utf8');

function addI18n(enDict, zhDict) {
    const enStr = Object.entries(enDict).map(([k, v]) => '    "' + k + '": "' + v + '",').join('\n');
    const zhStr = Object.entries(zhDict).map(([k, v]) => '    "' + k + '": "' + v + '",').join('\n');
    
    i18nContent = i18nContent.replace(/en: \{/, 'en: {\n' + enStr);
    i18nContent = i18nContent.replace(/zh: \{/, 'zh: {\n' + zhStr);
    fs.writeFileSync(i18nPath, i18nContent, 'utf8');
}

function patchFile(filePath, componentName, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (!content.includes('useTranslation')) {
        content = content.replace(/(import .* from "lucide-react";\r?\n)/, "\ { useTranslation } from \\\"../hooks/useTranslation\\\";\n");
    }
    
    const componentRegex = new RegExp(\export function \\\\\(\\\\) \\{(?:(?!const \\{ t).)*?\, 's');
    if (!content.includes('const { t')) {
        content = content.replace(componentRegex, (match) => {
            return match + \\n  const { t } = useTranslation();\n\;
        });
    }
    
    replacements.forEach(([oldStr, newStr]) => {
        content = content.split(oldStr).join(newStr);
    });
    
    fs.writeFileSync(filePath, content, 'utf8');
}

addI18n({
    'profile.title': 'Profile',
    'profile.user_not_found': 'User Not Found',
    'profile.user_not_found_desc': 'The user you\\'re looking for doesn\\'t exist or their profile has been removed.',
    'profile.back_talent': 'Back to Talent Pool',
    'profile.dm': 'Direct Message',
    'profile.edit': 'Edit Profile',
    'profile.bio': 'Bio',
    'profile.no_bio': 'No bio provided',
    'profile.contact': 'Contact',
    'profile.email_not_public': 'Email not public',
    'profile.location': 'Location',
    'profile.not_provided': 'Not provided',
    'profile.website': 'Website',
    'profile.skills': 'Specialization & Skills',
    'profile.no_skills': 'No skills listed',
    'profile.links': 'Links',
    'profile.research_pub': 'Research & Publications',
    'profile.ai_strategy': 'AI Strategy & Project Needs',
    'profile.articles_contrib': 'Articles & Contributions',
    'profile.published_content': 'Published Content',
    'profile.no_published': 'No published content yet.'
}, {
    'profile.title': '个人主页',
    'profile.user_not_found': '未找到用户',
    'profile.user_not_found_desc': '您寻找的用户不存在或其主页已被移除。',
    'profile.back_talent': '返回人才库',
    'profile.dm': '发送私信',
    'profile.edit': '编辑个人资料',
    'profile.bio': '个人简介',
    'profile.no_bio': '未提供个人简介',
    'profile.contact': '联系方式',
    'profile.email_not_public': '邮箱未公开',
    'profile.location': '所在地',
    'profile.not_provided': '未提供',
    'profile.website': '网站',
    'profile.skills': '专业技能',
    'profile.no_skills': '未列出技能',
    'profile.links': '外部链接',
    'profile.research_pub': '研究与出版物',
    'profile.ai_strategy': 'AI战略与项目需求',
    'profile.articles_contrib': '文章与贡献',
    'profile.published_content': '已发布内容',
    'profile.no_published': '暂无已发布内容。'
});

patchFile('src/pages/Profile.tsx', 'Profile', [
    ['usePageTitle("Profile")', 'usePageTitle(t("profile.title"))'],
    ['title="User Not Found"', 'title={t("profile.user_not_found")}'],
    ['description="The user you\'re looking for doesn\'t exist or their profile has been removed."', 'description={t("profile.user_not_found_desc")}'],
    ['Back to Talent Pool', '{t("profile.back_talent")}'],
    ['Direct Message', '{t("profile.dm")}'],
    ['Edit Profile', '{t("profile.edit")}'],
    ['<h3 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">\n                <Briefcase className="h-5 w-5 text-indigo-400" />\n                Bio\n              </h3>', '<h3 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">\n                <Briefcase className="h-5 w-5 text-indigo-400" />\n                {t("profile.bio")}\n              </h3>'],
    ['<p className="text-zinc-500 italic">No bio provided</p>', '<p className="text-zinc-500 italic">{t("profile.no_bio")}</p>'],
    ['<h3 className="text-lg font-semibold text-zinc-100 mb-4 border-b border-white/10 pb-2">Contact</h3>', '<h3 className="text-lg font-semibold text-zinc-100 mb-4 border-b border-white/10 pb-2">{t("profile.contact")}</h3>'],
    ['<p className="text-sm font-medium text-zinc-300">Email not public</p>', '<p className="text-sm font-medium text-zinc-300">{t("profile.email_not_public")}</p>'],
    ['<p className="text-xs text-zinc-500 mb-1">Location</p>', '<p className="text-xs text-zinc-500 mb-1">{t("profile.location")}</p>'],
    ['<p className="text-sm text-zinc-500 italic">Not provided</p>', '<p className="text-sm text-zinc-500 italic">{t("profile.not_provided")}</p>'],
    ['<p className="text-xs text-zinc-500 mb-1">Website</p>', '<p className="text-xs text-zinc-500 mb-1">{t("profile.website")}</p>'],
    ['<h3 className="text-lg font-semibold text-zinc-100 mb-4 border-b border-white/10 pb-2">Specialization & Skills</h3>', '<h3 className="text-lg font-semibold text-zinc-100 mb-4 border-b border-white/10 pb-2">{t("profile.skills")}</h3>'],
    ['<p className="text-sm text-zinc-500 italic">No skills listed</p>', '<p className="text-sm text-zinc-500 italic">{t("profile.no_skills")}</p>'],
    ['<h3 className="text-lg font-semibold text-zinc-100 mb-4 border-b border-white/10 pb-2">Links</h3>', '<h3 className="text-lg font-semibold text-zinc-100 mb-4 border-b border-white/10 pb-2">{t("profile.links")}</h3>'],
    ['{user.role === "EXPERT" ? "Research & Publications" : user.role === "ENTERPRISE_LEADER" ? "AI Strategy & Project Needs" : user.role === "LEARNER" ? "Articles & Contributions" : "Published Content"}', '{user.role === "EXPERT" ? t("profile.research_pub") : user.role === "ENTERPRISE_LEADER" ? t("profile.ai_strategy") : user.role === "LEARNER" ? t("profile.articles_contrib") : t("profile.published_content")}'],
    ['<p className="text-zinc-500">No published content yet.</p>', '<p className="text-zinc-500">{t("profile.no_published")}</p>']
]);

console.log("Profile patched");