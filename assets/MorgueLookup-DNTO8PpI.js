import{r as i,j as e,E as re,y as oe,a as ne,b as ie,d as le,t as I,D as de,H as ce}from"./index-Ch43QjP7.js";import me from"./EmployeeCredentialsSection-Ce_4XWcO.js";import"./GtaCallback-pOt-pelE.js";(function(){try{var n=typeof window<"u"?window:typeof global<"u"?global:typeof globalThis<"u"?globalThis:typeof self<"u"?self:{};n.SENTRY_RELEASE={id:"9a159e580b7ab5ef17a44b06f8457dcb9639f384"};var w=new n.Error().stack;w&&(n._sentryDebugIds=n._sentryDebugIds||{},n._sentryDebugIds[w]="a50e79a3-9839-49e1-b8d9-73724af76aae",n._sentryDebugIdIdentifier="sentry-dbid-a50e79a3-9839-49e1-b8d9-73724af76aae")}catch{}})();const ue=({show:n,onClose:w,record:o,darkMode:A})=>{const[b,T]=i.useState(!1);if(!n||!o)return null;const t=o.bullets?Array.isArray(o.bullets)?o.bullets:[o.bullets]:[],u=()=>{const c=re(o);navigator.clipboard.writeText(c).then(()=>{T(!0),setTimeout(()=>T(!1),2e3)})};return e.jsxs("div",{className:"autopsy-modal-overlay","data-theme":A?"dark":"light",onClick:w,children:[e.jsxs("div",{className:"autopsy-modal-content",onClick:c=>c.stopPropagation(),children:[e.jsx("span",{className:"autopsy-modal-close",onClick:w,children:"×"}),e.jsxs("div",{className:"d-flex justify-content-between align-items-start",children:[e.jsxs("div",{children:[e.jsxs("h2",{className:"autopsy-modal-title",children:["Morgue Intake Records for ",o.name]}),e.jsxs("p",{className:"autopsy-modal-subtitle",children:["CASE #",o.caseId]})]}),e.jsxs("button",{className:`autopsy-copy-btn ${b?"copied":""}`,onClick:u,title:"Copy BBCode for Forums",children:[e.jsx("i",{className:`fas ${b?"fa-check":"fa-copy"} me-2`}),b?"Copied!":"Copy BBCode"]})]}),e.jsxs("div",{className:"autopsy-warning-banner",children:[e.jsx("i",{className:"fas fa-exclamation-triangle me-2"}),e.jsx("strong",{children:"NOTICE:"})," Law Enforcement MAY use the PHMC Morgue Intake Records for PKs as proof of deaths for court cases. CKs will require a formal autopsy process which can be requested on the PHMC Forums."]}),o.adminNote&&e.jsxs("div",{className:"autopsy-admin-note-section",children:[e.jsxs("h4",{children:[e.jsx("i",{className:"fas fa-sticky-note me-2"}),"Admin Notes / Injuries"]}),e.jsx("p",{children:o.adminNote})]}),e.jsx("hr",{className:"autopsy-modal-hr"}),e.jsxs("div",{className:"autopsy-data-grid",children:[e.jsxs("div",{className:"autopsy-data-section",children:[e.jsx("h4",{children:"Vital Statistics"}),e.jsxs("div",{className:"autopsy-field",children:[e.jsx("span",{className:"autopsy-label",children:"Estimated Age"}),e.jsx("span",{children:o.estimatedAge})]}),e.jsxs("div",{className:"autopsy-field",children:[e.jsx("span",{className:"autopsy-label",children:"Physical Description"}),e.jsx("div",{className:"autopsy-text-block",children:o.physicalDescription})]}),e.jsxs("div",{className:"autopsy-field",children:[e.jsx("span",{className:"autopsy-label",children:"Identifying Marks / Tattoos"}),e.jsx("span",{children:o.tattoos})]})]}),e.jsxs("div",{className:"autopsy-data-section",children:[e.jsx("h4",{children:"Discovery Details"}),e.jsxs("div",{className:"autopsy-field",children:[e.jsx("span",{className:"autopsy-label",children:"Time of Death"}),e.jsx("span",{children:o.timeOfDeath})]}),e.jsxs("div",{className:"autopsy-field",children:[e.jsx("span",{className:"autopsy-label",children:"Location of Discovery"}),e.jsx("span",{children:o.location})]}),e.jsxs("div",{className:"autopsy-field",children:[e.jsx("span",{className:"autopsy-label",children:"Cause of Death"}),e.jsx("span",{style:{color:"var(--modal-danger)",fontWeight:"bold"},children:o.causeOfDeath})]}),e.jsxs("div",{className:"autopsy-field",children:[e.jsx("span",{className:"autopsy-label",children:"DNA Profile"}),e.jsx("span",{className:"font-monospace small",children:o.dnaProfile})]})]}),e.jsxs("div",{className:"autopsy-data-section",style:{gridColumn:"span 2"},children:[e.jsx("h4",{children:"Forensic Collection & Toxicology"}),e.jsxs("div",{className:"ooc-disclaimer-warning",children:[e.jsx("i",{className:"fas fa-exclamation-triangle me-1"}),e.jsx("strong",{children:"OOC Information:"})," The data below (slugs, exact injuries, narcotics) is strictly Out of Character. Any use of this information In Character requires a formal autopsy request."]}),e.jsxs("div",{className:"ooc-disclaimer-note",children:[e.jsx("i",{className:"fas fa-flask me-1"}),e.jsx("strong",{children:"Law Enforcement Note:"})," Slugs and Alcohol readings are visual reference for Medical Examiners performing autopsies. If you require the slugs IC'ly on the PHMC Forums here -                             ",e.jsx("a",{href:"https://phmc.gta.world/viewforum.php?f=265",target:"_blank",rel:"noopener noreferrer",className:"autopsy-request-link",children:"Link To Autopsy"})]}),e.jsxs("div",{className:"autopsy-field",children:[e.jsx("span",{className:"autopsy-label",children:"Alcohol / Narcotics Screen"}),e.jsxs("span",{style:{color:o.bac!=="0.00%"||o.narcotics&&o.narcotics!=="None"?"var(--modal-danger)":"var(--modal-success)",fontWeight:"bold"},children:["BAC: ",o.bac," | Narcotics: ",o.narcotics]})]}),t.length>0&&e.jsxs("div",{className:"autopsy-field",children:[e.jsx("span",{className:"autopsy-label",children:"Evidence Collected (Bullets)"}),e.jsx("div",{children:t.map((c,k)=>e.jsxs("div",{className:"small",children:["• ",c.type]},k))})]}),o.findings&&o.findings.length>0&&e.jsxs("div",{className:"autopsy-field mt-3",children:[e.jsx("span",{className:"autopsy-label",children:"Autopsy Findings"}),e.jsx("div",{className:"table-responsive",children:e.jsxs("table",{className:"autopsy-findings-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Time"}),e.jsx("th",{children:"Wound Type"}),e.jsx("th",{children:"Body Part"}),e.jsx("th",{children:"Dist."})]})}),e.jsx("tbody",{children:o.findings.map((c,k)=>e.jsxs("tr",{children:[e.jsx("td",{children:c.time}),e.jsx("td",{children:c.type}),e.jsx("td",{children:c.part}),e.jsx("td",{children:c.dist})]},k))})]})})]})]})]})]}),e.jsx("style",{children:`
                .autopsy-modal-overlay[data-theme="dark"] {
                    --modal-content-bg: #2c2f33;
                    --modal-text: #dcddde;
                    --modal-text-secondary: #b9bbbe;
                    --modal-text-muted: #8e9297;
                    --modal-border: #40444b;
                    --modal-section-bg: #36393f;
                    --modal-section-border: #40444b;
                    --modal-label: #72767d;
                    --modal-text-block-bg: #40444b;
                    --modal-text-block-border: #555;
                    --modal-text-block-text: #b9bbbe;
                    --modal-hr: #40444b;
                    --modal-close: #72767d;
                    --modal-close-hover: #dcddde;
                    --modal-title: #dcddde;
                    --modal-subtitle: #5dade2;
                    --modal-section-title: #b9bbbe;
                    --modal-accent: #3498db;
                    --modal-table-header-bg: #23262a;
                    --modal-table-header-text: #b9bbbe;
                    --modal-table-header-border: #5dade2;
                    --modal-table-row-border: #40444b;
                    --modal-table-row-hover: #36393f;
                    --modal-shadow: 0 20px 50px rgba(0,0,0,0.7);
                    --modal-copy-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    --modal-copy-shadow-hover: 0 4px 8px rgba(0,0,0,0.4);
                    --modal-warning-bg: #332b00;
                    --modal-warning-border: #665500;
                    --modal-warning-text: #ffd966;
                    --modal-admin-note-bg: #1a2332;
                    --modal-admin-note-border: #3498db;
                    --modal-admin-note-title: #b9bbbe;
                    --modal-admin-note-text: #b9bbbe;
                    --modal-ooc-bg: #0d2137;
                    --modal-ooc-border: #1a4971;
                    --modal-ooc-text: #8ab4f8;
                    --modal-danger: #f14a4a;
                    --modal-success: #2ea043;
                    --modal-warning: #f0a832;
                }

                .autopsy-modal-overlay[data-theme="light"] {
                    --modal-content-bg: #ffffff;
                    --modal-text: #333;
                    --modal-text-secondary: #666;
                    --modal-text-muted: #95a5a6;
                    --modal-border: #f0f0f0;
                    --modal-section-bg: #fdfdfd;
                    --modal-section-border: #f0f0f0;
                    --modal-label: #7f8c8d;
                    --modal-text-block-bg: #f9f9f9;
                    --modal-text-block-border: #ddd;
                    --modal-text-block-text: #444;
                    --modal-hr: #eee;
                    --modal-close: #95a5a6;
                    --modal-close-hover: #2c3e50;
                    --modal-title: #2c3e50;
                    --modal-subtitle: #3498db;
                    --modal-section-title: #2c3e50;
                    --modal-accent: #3498db;
                    --modal-table-header-bg: #f4f7f6;
                    --modal-table-header-text: #2c3e50;
                    --modal-table-header-border: #3498db;
                    --modal-table-row-border: #eee;
                    --modal-table-row-hover: #f9f9f9;
                    --modal-shadow: 0 20px 50px rgba(0,0,0,0.5);
                    --modal-copy-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    --modal-copy-shadow-hover: 0 4px 8px rgba(0,0,0,0.15);
                    --modal-warning-bg: #fff3cd;
                    --modal-warning-border: #ffeeba;
                    --modal-warning-text: #856404;
                    --modal-admin-note-bg: #f0f7fd;
                    --modal-admin-note-border: #3498db;
                    --modal-admin-note-title: #2c3e50;
                    --modal-admin-note-text: #34495e;
                    --modal-ooc-bg: #e8f4fd;
                    --modal-ooc-border: #bee5eb;
                    --modal-ooc-text: #0c5460;
                    --modal-danger: #c0392b;
                    --modal-success: #27ae60;
                    --modal-warning: #e67e22;
                }

                .autopsy-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.75);
                    z-index: 2000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    backdrop-filter: blur(4px);
                }

                .autopsy-modal-content {
                    background: var(--modal-content-bg);
                    width: 850px;
                    max-height: 90vh;
                    border-radius: 12px;
                    padding: 40px;
                    overflow-y: auto;
                    position: relative;
                    box-shadow: var(--modal-shadow);
                    color: var(--modal-text);
                }

                .autopsy-modal-close {
                    position: absolute;
                    top: 20px;
                    right: 25px;
                    font-size: 2rem;
                    cursor: pointer;
                    color: var(--modal-close);
                    transition: color 0.2s;
                }

                .autopsy-modal-close:hover {
                    color: var(--modal-close-hover);
                }

                .autopsy-modal-title {
                    margin-top: 0;
                    color: var(--modal-title);
                    font-weight: 700;
                    font-size: 1.8rem;
                }

                .autopsy-modal-subtitle {
                    color: var(--modal-subtitle);
                    font-weight: 800;
                    margin-top: -10px;
                    letter-spacing: 1px;
                }

                .autopsy-modal-hr {
                    border: 0;
                    border-top: 1px solid var(--modal-hr);
                    margin: 20px 0;
                }

                .autopsy-data-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                }

                .autopsy-data-section {
                    background: var(--modal-section-bg);
                    border: 1px solid var(--modal-section-border);
                    padding: 20px;
                    border-radius: 8px;
                }

                .autopsy-data-section h4 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    color: var(--modal-section-title);
                    border-bottom: 3px solid var(--modal-accent);
                    padding-bottom: 8px;
                    font-size: 1rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .autopsy-field {
                    margin-bottom: 15px;
                    font-size: 0.95rem;
                }

                .autopsy-label {
                    font-weight: 800;
                    color: var(--modal-label);
                    display: block;
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }

                .autopsy-text-block {
                    font-size: 0.85rem;
                    line-height: 1.5;
                    color: var(--modal-text-block-text);
                    background: var(--modal-text-block-bg);
                    padding: 10px;
                    border-radius: 4px;
                    border-left: 3px solid var(--modal-text-block-border);
                }

                .autopsy-findings-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8rem;
                    margin-top: 10px;
                }

                .autopsy-findings-table th {
                    background: var(--modal-table-header-bg);
                    text-align: left;
                    padding: 10px;
                    border-bottom: 2px solid var(--modal-table-header-border);
                    color: var(--modal-table-header-text);
                }

                .autopsy-findings-table td {
                    padding: 10px;
                    border-bottom: 1px solid var(--modal-table-row-border);
                }

                .autopsy-findings-table tr:hover {
                    background: var(--modal-table-row-hover);
                }

                .autopsy-copy-btn {
                    background: var(--modal-accent);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 8px 16px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    box-shadow: var(--modal-copy-shadow);
                }

                .autopsy-copy-btn:hover {
                    background: #2980b9;
                    transform: translateY(-1px);
                    box-shadow: var(--modal-copy-shadow-hover);
                }

                .autopsy-copy-btn.copied {
                    background: var(--modal-success);
                }

                .autopsy-warning-banner {
                    background-color: var(--modal-warning-bg);
                    border: 1px solid var(--modal-warning-border);
                    color: var(--modal-warning-text);
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-top: 20px;
                    font-size: 0.85rem;
                    line-height: 1.4;
                }

                .autopsy-admin-note-section {
                    margin-top: 20px;
                    padding: 15px;
                    background: var(--modal-admin-note-bg);
                    border-left: 4px solid var(--modal-admin-note-border);
                    border-radius: 4px;
                }

                .autopsy-admin-note-section h4 {
                    margin-top: 0;
                    margin-bottom: 8px;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    color: var(--modal-admin-note-title);
                    font-weight: 800;
                    border: none;
                }

                .autopsy-admin-note-section p {
                    margin-bottom: 0;
                    font-size: 0.9rem;
                    color: var(--modal-admin-note-text);
                    font-style: italic;
                    line-height: 1.5;
                }

                .ooc-disclaimer-warning,
                .ooc-disclaimer-note {
                    padding: 10px 14px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                    font-size: 0.85rem;
                    line-height: 1.4;
                }

                .ooc-disclaimer-warning {
                    background-color: var(--modal-warning-bg);
                    border: 1px solid var(--modal-warning-border);
                    border-left: 4px solid var(--modal-warning);
                    color: var(--modal-warning-text);
                }

                .ooc-disclaimer-note {
                    background-color: var(--modal-ooc-bg);
                    border: 1px solid var(--modal-ooc-border);
                    border-left: 4px solid #17a2b8;
                    color: var(--modal-ooc-text);
                }

                .autopsy-request-link {
                    color: var(--modal-accent);
                    font-weight: 700;
                    text-decoration: none;
                    white-space: nowrap;
                }

                .autopsy-request-link:hover {
                    text-decoration: underline;
                }
            `})]})},fe=()=>{const{morgueRecords:n,factionsData:w,isLoadingData:o,loadMorgueRecords:A}=oe(),{isPhmcMember:b,user:T}=ne(),{user:t,isAuthenticated:u}=ie(),{showNotification:c}=le(),[k,q]=i.useState(""),[C,O]=i.useState(""),[W,Y]=i.useState(null),[G,F]=i.useState(!1),[he,be]=i.useState(!1),[h,U]=i.useState(null),[R,V]=i.useState(!1),m=window.location.hostname==="localhost",[j,E]=i.useState(1),$=15,[z,_]=i.useState(!1),[Q,J]=i.useState(localStorage.getItem("morgue_welcome_dismissed")==="true"),[S,X]=i.useState(()=>{const a=localStorage.getItem("morgue_dark_mode");return a!==null?a==="true":!0}),x=i.useMemo(()=>{if(!u||!t)return m&&h?{name:"Dev User",dept:h==="employee"?"PHMC Staff":"Authorized Personnel"}:null;const a=t?.allFactionCharacters?.[0],r=a?.character?.characterName||a?.characterName||t.username,l=t?.character||t?.characters,s=l&&l.length>0?l[0].characterName||`${l[0].firstname} ${l[0].lastname}`.trim()||l[0].name:null;return{name:t.faction?.characterName||t.activeCharacter?.characterName||r||s||t.username,dept:t.faction?.rank||(b?"PHMC Employee":"Authorized Personnel")}},[b,t,u,m,h]),d=i.useMemo(()=>m?h!=="denied":u,[u,h,m]);i.useMemo(()=>m&&h==="employee"?!0:b,[b,h,m]);const L=i.useMemo(()=>{if(!d||!n||n.length===0)return null;const a=Math.max(...n.map(f=>f.lastUpdated||0));if(!a)return null;const r=Date.now(),l=1440*60*1e3,s=a+l,v=Math.max(0,Math.ceil((s-r)/(1e3*60*60)));return{last:new Date(a).toLocaleString([],{dateStyle:"short",timeStyle:"short"}),next:v>0?`${v}h`:"Soon",isOverdue:r>s}},[n,d]),D=i.useMemo(()=>!d||!n?[]:[...n].sort((r,l)=>{const s=Number(r.caseId)||0;return(Number(l.caseId)||0)-s}).filter(r=>((r.name||"").toLowerCase().includes(C.toLowerCase())||String(r.caseId||"").toLowerCase().includes(C.toLowerCase())||(r.location||"").toLowerCase().includes(C.toLowerCase()))&&(!R||(r.causeOfDeath||"").includes("((CK))"))),[n,C,d,R]),H=j*$,Z=H-$,B=D.slice(Z,H),P=Math.ceil(D.length/$),ee=a=>{const l=(()=>{try{const g=localStorage.getItem("gta-user-data");if(g){const y=JSON.parse(g),p=y?.character||y?.characters,se=p&&p.length>0?p[0].characterName||`${p[0].firstname} ${p[0].lastname}`.trim()||p[0].name:null;return{username:y?.username,characterName:y?.faction?.characterName||y?.activeCharacter?.characterName||se}}}catch{}return{username:null,characterName:null}})(),s=t?.username||l.username||"Unknown OAuth",f=(()=>{if(t?.faction?.characterName)return t.faction.characterName;if(t?.activeCharacter?.characterName)return t.activeCharacter.characterName;const g=t?.allFactionCharacters?.[0];if(g)return g.character?.characterName||g.characterName;const y=t?.character||t?.characters;if(y&&y.length>0){const p=y[0];return p.characterName||`${p.firstname} ${p.lastname}`.trim()||p.name}return l.characterName})()||"Unknown Character",M=new Date().toLocaleString();if(!m&&s==="Unknown OAuth"&&f==="Unknown Character"){c("Session not fully loaded. Please refresh and try again.","warning");return}console.log(`[Audit] [${m?"Local Dev":"Production"}] USER - ${s} - ${f} has accessed CASE #${a.caseId} - ${a.name} at ${M}`);const N={embeds:[{title:"Morgue Record Accessed",color:3447003,description:`**${f}** ((${s})) is viewing a detailed autopsy report.`,fields:[{name:"Environment",value:m?"🔧 Local Dev":"🌐 Production",inline:!0},{name:"Case Number",value:String(a.caseId),inline:!0},{name:"Decedent Name",value:a.name,inline:!0},{name:"Time of Death",value:a.timeOfDeath||"Unknown",inline:!0},{name:"Access Time",value:M,inline:!1}],footer:{text:"PHMC Morgue Access Audit"}}]};I("admin",N).catch(g=>console.error("Failed to send access audit:",g)),Y(a),F(!0)},K=a=>{E(a),document.querySelector(".morgue-table-container")?.scrollTo(0,0)};i.useEffect(()=>{const a=r=>{if(r.ctrlKey&&r.altKey&&r.key.toLowerCase()==="d"){const l=!z;if(_(l),l){console.log("[MorgueLookup] Diagnostics Enabled");const s=t?.character||t?.characters,v=s&&s.length>0?s[0].characterName||`${s[0].firstname} ${s[0].lastname}`.trim()||s[0].name:null,f=s&&s.length>0?s[0].id:null,M=t?.faction?.characterId||t?.activeCharacter?.characterId||t?.faction?.id||f,N=t?.faction?.characterName||t?.activeCharacter?.characterName||v;ce(`Morgue Access Diagnostic: ${N||"Unknown"} (${t?.username||"No User"})`,{level:"info",tags:{component:"MorgueLookup",access_status:d?"granted":"denied",is_phmc:b},extra:{identity:{charId:M,charName:N,username:t?.username,isAuthenticated:u},access_logic:{hasAccess:d,isPhmcMember:b,devAccessOverride:h,isLocalHost:m},database:{recordsCount:n?.length||0,filteredCount:D?.length||0},timestamp:new Date().toISOString()}})}}};return window.addEventListener("keydown",a),()=>window.removeEventListener("keydown",a)},[z,u,t,d,b]),i.useEffect(()=>{if(d&&u&&t){const a=t?.character||t?.characters,r=a&&a.length>0?a[0].characterName||`${a[0].firstname} ${a[0].lastname}`.trim()||a[0].name:null,l=a&&a.length>0?a[0].id:null,s=t.faction?.characterId||t.activeCharacter?.characterId||t.faction?.id||l,v=t.faction?.characterName||t.activeCharacter?.characterName||r;if(!s||!v){console.log("[MorgueLookup] Access granted but character data not yet resolved. Deferring audit log...");return}const f=`morgue_access_notified_${s}`;if(!sessionStorage.getItem(f)){const N={embeds:[{title:"Morgue Lookup Access: GRANTED",color:3066993,fields:[{name:"Username",value:t.username||"Unknown",inline:!0},{name:"Character",value:v,inline:!0},{name:"Character ID",value:String(s),inline:!0},{name:"Timestamp",value:new Date().toLocaleString(),inline:!1}],footer:{text:"PHMC Morgue Security Audit"}}]};I("admin",N).catch(g=>console.error("Failed to send morgue access notification:",g)),sessionStorage.setItem(f,"true")}}},[d,u,t]),i.useEffect(()=>{d&&A()},[d,A]);const ae=i.useCallback(async()=>{const a={content:`<@228306972204597248> user: ${t?.username||"Unknown"}, character: ${x?.name||"Unknown User"} is requesting a morgue update. Total records: ${n?.length||0}`,embeds:[{title:"Morgue Update Requested",color:15105570,description:`**${x?.name||"Unknown User"}** (${t?.username||"Unknown"}) is requesting a manual update of morgue records.`,fields:[{name:"Environment",value:m?"🔧 Local Dev":"🌐 Production",inline:!0},{name:"Total Records",value:String(n?.length||0),inline:!0},{name:"Request Time",value:new Date().toLocaleString(),inline:!1}],footer:{text:"PHMC Morgue Update Request"}}]};try{await I("admin",a),c("Request sent - You may be contacted via Discord to keep you updated. If you require a specific entry please contact Fr0styDev on Discord, or PHMC Lobby","success")}catch{c("Failed to send update request. Try again later.","error")}},[x,t,m,n,c]),te=()=>{X(a=>{const r=!a;return localStorage.setItem("morgue_dark_mode",String(r)),r})};return e.jsxs("div",{className:`morgue-lookup-page ${S?"dark-theme":"light-theme"}`,children:[e.jsx(de,{}),e.jsxs("aside",{className:"morgue-sidebar",children:[e.jsx("div",{className:"morgue-sidebar-header",children:"Morgue Intake System"}),x&&e.jsxs("div",{className:"morgue-user-welcome mb-4 p-3 rounded bg-dark bg-opacity-25 border border-secondary border-opacity-50",children:[e.jsx("div",{className:"small opacity-75 text-uppercase fw-bold mb-1",style:{fontSize:"0.65rem",letterSpacing:"1px",color:"#3498db"},children:"Welcome Back"}),e.jsx("div",{className:"fw-bold text-white mb-1",style:{fontSize:"1.05rem"},children:x.name}),e.jsx("div",{className:"small opacity-75",style:{fontSize:"0.8rem",fontStyle:"italic"},children:x.dept})]}),e.jsxs("div",{className:"morgue-search-box",children:[e.jsx("label",{htmlFor:"decedentSearch",children:"DECEDENT LOOKUP"}),e.jsx("input",{type:"text",id:"decedentSearch",placeholder:"Enter name, case #...",value:k,disabled:!d,onChange:a=>q(a.target.value),onKeyDown:a=>{if(a.key==="Enter"){const r=a.target.value.trim(),l=r?(n||[]).filter(s=>(s.name||"").toLowerCase().includes(r.toLowerCase())||String(s.caseId||"").toLowerCase().includes(r.toLowerCase())||(s.location||"").toLowerCase().includes(r.toLowerCase())).length:(n||[]).length;O(r),E(1),I("admin",{embeds:[{title:"Morgue Search",color:3447003,description:`**${x?.name||"Unknown"}** searched the Morgue database.`,fields:[{name:"Search Term",value:`\`${r||"(none - showing all)"}\``,inline:!0},{name:"Results",value:String(l),inline:!0},{name:"Username",value:t?.username||"Unknown",inline:!0}],timestamp:new Date().toISOString(),footer:{text:"PHMC Morgue Usage Analytics"}}]}).catch(s=>{console.error("[MorgueLookup] Search webhook failed:",s),I("admin",{embeds:[{title:"⚠️ Morgue Search Webhook Failed",color:16761095,description:`**User:** ${x?.name||"Unknown"}
**Search:** \`${r||"(none)"}\`
**Error:** ${s.message||"Unknown"}`,timestamp:new Date().toISOString()}]}).catch(()=>{})})}}}),e.jsxs("div",{className:"morgue-search-hint",children:["Press Enter to search. You can search by name, case number, or location.",C&&e.jsxs("button",{className:"morgue-search-reset",onClick:()=>{O(""),q(""),E(1)},children:[e.jsx("i",{className:"fas fa-times me-1"}),"Clear"]})]})]}),d&&e.jsxs("div",{className:"morgue-sidebar-info mt-4",children:[e.jsx("div",{className:"small text-muted mb-2 text-uppercase fw-bold",children:"Filtered Results"}),e.jsx("div",{className:"display-6 fw-bold",children:D.length})]}),d&&e.jsxs("div",{className:"morgue-sidebar-filter mt-3",children:[e.jsxs("label",{className:"d-flex align-items-center gap-2",style:{cursor:"pointer",userSelect:"none"},children:[e.jsx("input",{type:"checkbox",checked:R,onChange:a=>{V(a.target.checked),E(1)}}),e.jsxs("span",{className:"small",style:{color:"var(--sidebar-text-muted)"},children:[e.jsx("i",{className:"fas fa-skull me-1"}),"CK deaths only"]})]}),e.jsx("div",{className:"small mt-1",style:{color:"var(--text-muted)",fontSize:"0.65rem",lineHeight:1.3},children:"Relies on Cause of Death field — not an accurate metric"})]}),m&&e.jsxs("div",{className:"morgue-sidebar-dev p-3 border border-warning rounded bg-dark bg-opacity-25",children:[e.jsxs("div",{className:"small text-warning mb-2 text-uppercase fw-bold",children:[e.jsx("i",{className:"fas fa-tools me-2"}),"Dev Access Override"]}),e.jsxs("div",{className:"d-flex flex-column gap-2",children:[e.jsx("button",{className:`btn btn-sm ${h==="employee"?"btn-success":"btn-outline-success text-light"}`,onClick:()=>U(h==="employee"?null:"employee"),children:"Simulate Employee"}),e.jsx("button",{className:`btn btn-sm ${h==="denied"?"btn-danger":"btn-outline-danger text-light"}`,onClick:()=>U(h==="denied"?null:"denied"),children:"Simulate Denied"})]}),h&&e.jsx("button",{className:"btn btn-link btn-sm text-muted mt-2 p-0 w-100 text-decoration-none",onClick:()=>U(null),children:"Clear Override"})]}),e.jsx("div",{className:"morgue-sidebar-theme-toggle mt-auto",children:e.jsxs("button",{className:"morgue-theme-btn",onClick:te,title:S?"Switch to light theme":"Switch to dark theme",children:[e.jsx("i",{className:`fas ${S?"fa-sun":"fa-moon"} me-2`}),S?"Light Mode":"Dark Mode"]})})]}),e.jsxs("main",{className:"morgue-main",children:[e.jsx("header",{className:"morgue-header d-flex justify-content-between align-items-center",children:e.jsx("div",{children:e.jsx("h2",{style:{margin:0,fontWeight:700},children:"Active Intake Records"})})}),d&&!Q&&e.jsxs("div",{className:"morgue-welcome-banner",children:[e.jsxs("div",{className:"morgue-welcome-content",children:[e.jsx("div",{className:"morgue-welcome-icon",children:e.jsx("i",{className:"fas fa-microscope"})}),e.jsxs("div",{className:"morgue-welcome-text",children:[e.jsx("strong",{children:"Welcome to the Morgue Intake System."})," Records are updated daily. If something is missing, use the ",e.jsx("strong",{children:"Request Update"})," button to notify staff."]})]}),e.jsx("button",{className:"morgue-welcome-close",onClick:()=>{localStorage.setItem("morgue_welcome_dismissed","true"),J(!0)},title:"Dismiss",children:e.jsx("i",{className:"fas fa-times"})})]}),z&&e.jsxs("div",{className:"morgue-diagnostics-panel p-3 border-bottom bg-info bg-opacity-10",children:[e.jsxs("div",{className:"d-flex justify-content-between align-items-start mb-2",children:[e.jsxs("h6",{className:"mb-0 text-info fw-bold",children:[e.jsx("i",{className:"fas fa-microscope me-2"}),"Access Diagnostics"]}),e.jsx("button",{className:"btn-close btn-close-sm",onClick:()=>_(!1)})]}),e.jsxs("div",{className:"row g-3",children:[e.jsx("div",{className:"col-md-3",children:e.jsxs("div",{className:"diag-item",children:[e.jsx("label",{children:"Authentication"}),e.jsx("div",{className:u?"text-success":"text-danger",children:u?"AUTHENTICATED":"NOT AUTHENTICATED"}),e.jsx("small",{className:"text-muted",children:t?.username||"No Username"})]})}),e.jsx("div",{className:"col-md-3",children:e.jsxs("div",{className:"diag-item",children:[e.jsx("label",{children:"Access Status"}),e.jsx("div",{className:d?"text-success":"text-danger",children:d?"GRANTED":"DENIED"}),e.jsxs("div",{className:"diag-tags mt-1",children:[b&&e.jsx("span",{className:"badge bg-primary me-1",children:"PHMC"}),m&&e.jsx("span",{className:"badge bg-warning text-dark me-1",children:"Local"})]})]})}),e.jsx("div",{className:"col-md-3",children:e.jsxs("div",{className:"diag-item",children:[e.jsx("label",{children:"Resolved Identity"}),e.jsx("div",{className:"text-truncate",title:x?.name,children:x?.name||"Unknown"}),e.jsxs("small",{className:"font-monospace text-muted",style:{fontSize:"0.7rem"},children:["ID: ",t?.faction?.characterId||t?.activeCharacter?.characterId||"None"]})]})}),e.jsx("div",{className:"col-md-3",children:e.jsxs("div",{className:"diag-item",children:[e.jsx("label",{children:"Database State"}),e.jsxs("div",{children:["Records: ",n?.length||0]}),e.jsxs("small",{className:"text-muted",children:["Filtered: ",D.length]})]})})]})]}),e.jsx("div",{className:"morgue-table-container",children:o?e.jsxs("div",{className:"text-center p-5",children:[e.jsx("i",{className:"fas fa-circle-notch fa-spin fa-3x mb-3 text-primary"}),e.jsx("p",{className:"text-muted",children:"Synchronizing with Morgue Database..."})]}):d?e.jsxs(e.Fragment,{children:[e.jsxs("table",{className:"morgue-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Case #"}),e.jsx("th",{children:"Name"}),e.jsx("th",{children:"Time of Death"}),e.jsx("th",{children:"Location"}),e.jsx("th",{children:"Action"})]})}),e.jsx("tbody",{children:B.length>0?B.map(a=>e.jsxs("tr",{children:[e.jsx("td",{children:e.jsx("span",{className:"badge bg-secondary opacity-75",children:a.caseId})}),e.jsx("td",{children:e.jsx("strong",{children:a.name})}),e.jsx("td",{children:a.timeOfDeath}),e.jsx("td",{children:e.jsx("span",{className:"small",children:a.location})}),e.jsx("td",{children:e.jsx("div",{className:"d-flex flex-column gap-1",children:e.jsx("button",{className:"morgue-btn-view",onClick:()=>ee(a),children:"View Morgue Data"})})})]},a.firebaseKey)):e.jsx("tr",{children:e.jsxs("td",{colSpan:"5",children:[e.jsxs("div",{className:"text-center p-5 morgue-text-muted",children:[e.jsx("i",{className:"fas fa-search fa-2x mb-3 opacity-25"}),e.jsx("p",{className:"mb-1",children:"No records found matching your search."}),e.jsx("p",{className:"small mb-3 opacity-75",children:"Records are synced once daily. If the decedent or case you're looking for is recent, it may not have been imported yet."}),e.jsxs("button",{className:"morgue-btn-request-update mx-auto d-inline-flex",onClick:ae,children:[e.jsx("i",{className:"fas fa-paper-plane me-1"}),"Request Update"]})]}),e.jsx("div",{className:"mx-auto mb-4 p-3 rounded bg-warning bg-opacity-10 border border-warning border-opacity-25",style:{maxWidth:"500px"},children:e.jsxs("div",{className:"d-flex align-items-start gap-2",children:[e.jsx("i",{className:"fas fa-lightbulb text-warning mt-1"}),e.jsxs("div",{className:"small morgue-text-muted",children:[e.jsx("strong",{className:"text-warning",children:"Tip:"})," Try searching by the decedent's full name, case number, or location. If you're sure the record exists in the Morgue Database, use the ",e.jsx("strong",{children:"Request Update"})," button above to notify staff or ask Fr0styDev on Discord for a specific entry."]})]})})]})})})]}),P>1&&e.jsxs("div",{className:"morgue-pagination d-flex justify-content-center align-items-center p-4",children:[e.jsx("button",{className:"morgue-page-btn",onClick:()=>K(j-1),disabled:j===1,children:e.jsx("i",{className:"fas fa-chevron-left"})}),e.jsxs("div",{className:"mx-3",children:["Page ",e.jsx("span",{className:"fw-bold",children:j})," of ",P]}),e.jsx("button",{className:"morgue-page-btn",onClick:()=>K(j+1),disabled:j===P,children:e.jsx("i",{className:"fas fa-chevron-right"})})]})]}):e.jsxs("div",{className:"text-center p-5 mt-5",children:[e.jsx("div",{className:"access-denied-icon mb-4",children:e.jsx("i",{className:"fas fa-lock fa-4x text-danger opacity-50"})}),e.jsx("h3",{className:"fw-bold",children:"Access Restricted"}),e.jsx("p",{className:"text-muted mx-auto",style:{maxWidth:"500px"},children:"The Morgue Intake Database contains sensitive information. Access is restricted to authenticated PHMC Employees and authorized Law Enforcement personnel."}),!u&&e.jsx("div",{className:"mt-4 mx-auto",style:{maxWidth:"400px"},children:e.jsx(me,{showNotification:c,context:"Morgue Lookup"})})]})}),e.jsxs("footer",{className:"morgue-footer",children:[e.jsxs("div",{className:"me-auto small  opacity-75 d-flex align-items-center",children:[e.jsx("i",{className:"fas fa-info-circle me-2"}),"Any issues with accessing, please contact Fr0styDev (Alyson Frost) in the PHMC Discord."]}),L&&e.jsxs("div",{className:`morgue-status-badge ${L.isOverdue?"overdue":""}`,title:"Manual update process (24h cycle)",children:[e.jsx("i",{className:"fas fa-sync-alt fa-spin-hover me-2"}),e.jsx("span",{className:"label",children:"UPDATED:"}),e.jsx("span",{className:"time",children:L.last}),e.jsx("span",{className:"divider mx-2",children:"|"}),e.jsx("span",{className:"label",children:"NEXT:"}),e.jsx("span",{className:"time",children:L.next})]})]})]}),e.jsx(ue,{show:G,onClose:()=>F(!1),record:W,darkMode:S}),e.jsx("style",{children:`
                .morgue-lookup-page.dark-theme {
                    --page-bg: #1a1d21;
                    --surface-bg: #2c2f33;
                    --surface-hover: #36393f;
                    --border-color: #40444b;
                    --text-primary: #dcddde;
                    --text-secondary: #b9bbbe;
                    --text-muted: #8e9297;
                    --text-muted-light: #72767d;
                    --input-bg: #40444b;
                    --input-text: #dcddde;
                    --sidebar-bg: #15171a;
                    --sidebar-border: #40444b;
                    --sidebar-text: #dcddde;
                    --sidebar-text-muted: #b9bbbe;
                    --header-border: #40444b;
                    --table-header-bg: #23262a;
                    --table-header-text: #b9bbbe;
                    --table-header-border: #40444b;
                    --table-row-border: #33363b;
                    --shadow: rgba(0,0,0,0.4);
                    --shadow-sm: rgba(0,0,0,0.3);
                    --shadow-md: rgba(0,0,0,0.5);
                    --accent: #3498db;
                    --accent-hover: #5dade2;
                    --success: #2ea043;
                    --success-hover: #3fb950;
                    --danger: #f14a4a;
                    --danger-hover-bg: rgba(241, 74, 74, 0.15);
                    --warning: #f0a832;
                    --warning-hover: #f5b642;
                    --welcome-bg: linear-gradient(135deg, #1e3250, #2c2f33);
                    --welcome-text: #ffffff;
                    --page-btn-bg: #40444b;
                    --page-btn-hover: #3498db;
                    --page-btn-text: #dcddde;
                    --filtered-results-text: #dcddde;
                }

                .morgue-lookup-page.light-theme {
                    --page-bg: #f4f7f6;
                    --surface-bg: #ffffff;
                    --surface-hover: #f9f9f9;
                    --border-color: #ddd;
                    --text-primary: #333;
                    --text-secondary: #666;
                    --text-muted: #95a5a6;
                    --text-muted-light: #bdc3c7;
                    --input-bg: #ecf0f1;
                    --input-text: #333;
                    --sidebar-bg: #2c3e50;
                    --sidebar-border: #555;
                    --sidebar-text: #ffffff;
                    --sidebar-text-muted: #bdc3c7;
                    --header-border: #ddd;
                    --table-header-bg: #eee;
                    --table-header-text: #666;
                    --table-header-border: #d0d0d0;
                    --table-row-border: #eee;
                    --shadow: rgba(0,0,0,0.2);
                    --shadow-sm: rgba(0,0,0,0.05);
                    --shadow-md: rgba(0,0,0,0.15);
                    --accent: #3498db;
                    --accent-hover: #2980b9;
                    --success: #27ae60;
                    --success-hover: #219150;
                    --danger: #e74c3c;
                    --danger-hover-bg: rgba(231, 76, 60, 0.15);
                    --warning: #e67e22;
                    --warning-hover: #d35400;
                    --welcome-bg: linear-gradient(135deg, #2c3e50, #3498db);
                    --welcome-text: #ffffff;
                    --page-btn-bg: #eee;
                    --page-btn-hover: #3498db;
                    --page-btn-text: #ffffff;
                    --filtered-results-text: inherit;
                }

                .morgue-lookup-page {
                    display: flex;
                    height: 100vh;
                    background-color: var(--page-bg);
                    color: var(--text-primary);
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }

                .morgue-sidebar {
                    width: 300px;
                    background-color: var(--sidebar-bg);
                    color: var(--sidebar-text);
                    padding: 20px 20px 80px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 2px 0 5px var(--shadow);
                    z-index: 5;
                }

                .morgue-sidebar-header {
                    font-size: 1.2rem;
                    font-weight: bold;
                    margin-bottom: 30px;
                    border-bottom: 1px solid var(--sidebar-border);
                    padding-bottom: 10px;
                }

                .morgue-search-box label {
                    display: block;
                    font-size: 0.8rem;
                    margin-bottom: 8px;
                    color: var(--sidebar-text-muted);
                }

                .morgue-search-box input {
                    width: 100%;
                    padding: 10px;
                    border-radius: 4px;
                    border: none;
                    background: var(--input-bg);
                    color: var(--input-text);
                }

                .morgue-breadcrumb {
                    color: var(--text-muted);
                }

                .morgue-sidebar-info .text-muted {
                    color: var(--sidebar-text-muted) !important;
                }

                .morgue-text-muted {
                    color: var(--text-muted);
                }

                .morgue-search-hint {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    margin-top: 6px;
                    font-size: 0.7rem;
                    color: var(--text-muted);
                }

                .morgue-search-reset {
                    background: none;
                    border: none;
                    color: var(--danger);
                    font-size: 0.7rem;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 3px;
                    transition: background 0.2s;
                }

                .morgue-search-reset:hover {
                    background: var(--danger-hover-bg);
                }

                .morgue-main {
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .morgue-header {
                    padding: 20px;
                    background: var(--surface-bg);
                    border-bottom: 1px solid var(--border-color);
                }

                .morgue-sidebar-info .display-6 {
                    color: var(--filtered-results-text);
                }

                .morgue-sidebar-theme-toggle {
                    margin-top: auto;
                }

                .morgue-theme-btn {
                    width: 100%;
                    background: rgba(255,255,255,0.08);
                    color: var(--sidebar-text);
                    border: 1px solid var(--sidebar-border);
                    border-radius: 6px;
                    padding: 8px 12px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    opacity: 0.7;
                }

                .morgue-theme-btn:hover {
                    opacity: 1;
                    background: rgba(255,255,255,0.15);
                }

                .morgue-status-badge {
                    background: var(--sidebar-bg);
                    color: var(--sidebar-text);
                    padding: 8px 15px;
                    border-radius: 50px;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    box-shadow: 0 2px 5px var(--shadow);
                }

                .morgue-status-badge .label {
                    color: var(--accent);
                    font-weight: 800;
                    margin-right: 8px;
                    font-size: 0.7rem;
                }

                .morgue-status-badge .time {
                    font-weight: 600;
                }

                .morgue-table-container {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 0 20px 20px;
                }

                .morgue-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    margin-top: 20px;
                    background: var(--surface-bg);
                    box-shadow: 0 2px 10px var(--shadow-sm);
                    border-radius: 8px;
                }

                .morgue-table th {
                    position: sticky;
                    top: 0;
                    background: var(--table-header-bg);
                    text-align: left;
                    padding: 15px;
                    z-index: 3;
                    text-transform: uppercase;
                    font-size: 0.75rem;
                    letter-spacing: 1px;
                    color: var(--table-header-text);
                    border-bottom: 2px solid var(--table-header-border);
                }

                .morgue-table td {
                    padding: 15px;
                    border-bottom: 1px solid var(--table-row-border);
                }

                .morgue-table tr:hover {
                    background-color: var(--surface-hover);
                }

                .morgue-btn-view {
                    background: var(--success);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.8rem;
                    padding: 6px 12px;
                    transition: all 0.2s;
                }

                .morgue-btn-view:hover {
                    background: var(--success-hover);
                    transform: scale(1.02);
                }

                .morgue-btn-summary {
                    background: var(--accent);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.75rem;
                    padding: 4px 10px;
                    transition: all 0.2s;
                }

                .morgue-btn-summary:hover {
                    background: var(--accent-hover);
                    transform: scale(1.02);
                }

                .morgue-page-btn {
                    background: var(--page-btn-bg);
                    border: none;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: var(--text-primary);
                }

                .morgue-page-btn:hover:not(:disabled) {
                    background: var(--page-btn-hover);
                    color: var(--page-btn-text);
                }

                .morgue-page-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .morgue-footer {
                    padding: 15px 20px;
                    background: var(--surface-bg);
                    border-top: 1px solid var(--border-color);
                    display: flex;
                    gap: 15px;
                    justify-content: flex-end;
                }

                .morgue-btn-request {
                    background-color: var(--text-muted);
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                }

                .morgue-btn-request-update {
                    background-color: var(--warning);
                    color: white;
                    padding: 8px 16px;
                    border: none;
                    border-radius: 50px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 0.8rem;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    white-space: nowrap;
                }

                .morgue-btn-request-update:hover {
                    background-color: var(--warning-hover);
                    transform: scale(1.02);
                }

                .morgue-btn-add {
                    background-color: var(--sidebar-bg);
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                }

                .morgue-welcome-banner {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 20px;
                    margin: 0 20px 10px;
                    background: var(--welcome-bg);
                    color: var(--welcome-text);
                    border-radius: 8px;
                    box-shadow: 0 2px 8px var(--shadow-md);
                }

                .morgue-welcome-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 0;
                }

                .morgue-welcome-icon {
                    font-size: 1.4rem;
                    opacity: 0.8;
                }

                .morgue-welcome-text {
                    font-size: 0.9rem;
                    line-height: 1.4;
                }

                .morgue-welcome-close {
                    background: none;
                    border: none;
                    color: var(--welcome-text);
                    opacity: 0.6;
                    cursor: pointer;
                    padding: 4px 8px;
                    font-size: 1.1rem;
                    transition: opacity 0.2s;
                }

                .morgue-welcome-close:hover {
                    opacity: 1;
                }

                .fa-spin-hover:hover {
                    animation: fa-spin 2s infinite linear;
                }

                .morgue-status-badge.overdue {
                    border: 1px solid var(--danger);
                }

                .morgue-status-badge.overdue .label:last-of-type {
                    color: var(--danger);
                }

                @media (max-width: 768px) {
                    .morgue-sidebar {
                        display: none;
                    }
                }
            `})]})};export{fe as default};
