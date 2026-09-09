import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Activity,Award,BarChart3,Bell,ChevronRight,Crown,Gamepad2,Globe2,
  Home,LogOut,Menu,Search,Settings,Shield,Swords,Trophy,UserPlus,
  Users,X,Zap
} from 'lucide-react';
import {supabase} from './supabase';
import {signIn,signOut,signUp} from './auth';
import './styles.css';

const demo={games:1842,wins:988,kills:12648,deaths:1842,kpg:6.87,streak:8,rank:'Diamond'};

const games=[
 {name:'Call of Duty',short:'COD',games:742,wins:411,kills:5582,kpg:7.52},
 {name:'Fortnite',short:'FN',games:613,wins:328,kills:3940,kpg:6.43},
 {name:'Apex Legends',short:'APEX',games:487,wins:249,kills:3126,kpg:6.42}
];

const friends=[
 {name:'Nova',rank:'Diamond',kpg:7.41,wins:62,online:true},
 {name:'Rogue',rank:'Platinum',kpg:6.98,wins:58,online:true},
 {name:'Jett',rank:'Diamond',kpg:6.81,wins:55,online:false},
 {name:'Vex',rank:'Gold',kpg:5.92,wins:47,online:false}
];

const achievements=[
 ['First Blood','Get your first elimination.','Common',10],
 ['On Fire','Win 5 games in a row.','Rare',25],
 ['Sharpshooter','Reach 1,000 headshots.','Epic',50],
 ['Unstoppable','Reach a 10-win streak.','Legendary',100]
];

function Auth(){
 const[mode,setMode]=useState('login');
 const[email,setEmail]=useState('');
 const[password,setPassword]=useState('');
 const[username,setUsername]=useState('');
 const[displayName,setDisplayName]=useState('');
 const[busy,setBusy]=useState(false);
 const[msg,setMsg]=useState('');
 async function submit(e){
   e.preventDefault();setBusy(true);setMsg('');
   try{
     if(mode==='login') await signIn(email,password);
     else{
       await signUp({email,password,username,displayName});
       setMsg('Account created. Check your email if confirmation is enabled.');
       setMode('login');
     }
   }catch(err){setMsg(err.message||'Something went wrong.')}
   finally{setBusy(false)}
 }
 return <div className="auth-page"><div className="auth-card">
   <div className="brand-mark">F</div><div className="brand">FRAGRANK</div>
   <div className="tagline">TRACK. COMPETE. DOMINATE.</div>
   <h1>{mode==='login'?'Welcome back.':'Create your player account.'}</h1>
   <p className="muted">{mode==='login'?'Sign in to continue to your competitive profile.':'Build your profile and start climbing.'}</p>
   <form onSubmit={submit}>
    {mode==='signup'&&<>
      <label>Username<input value={username} onChange={e=>setUsername(e.target.value)} required/></label>
      <label>Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
    </>}
    <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
    <label>Password<input type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
    {msg&&<div className="notice">{msg}</div>}
    <button className="primary full" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign In':'Create Account'}</button>
   </form>
   <button className="text-button" onClick={()=>setMode(mode==='login'?'signup':'login')}>
    {mode==='login'?'Need an account? Create one':'Already have an account? Sign in'}
   </button>
 </div></div>
}

function Stat({icon:Icon,label,value,sub}){
 return <div className="stat"><div className="stat-icon"><Icon size={19}/></div><div>
  <span>{label}</span><b>{value}</b>{sub&&<small>{sub}</small>}
 </div></div>
}

function Chart(){
 const vals=[5.4,5.8,5.6,6.1,6.0,6.4,6.2,6.7,6.5,6.87];
 const max=Math.max(...vals),min=Math.min(...vals);
 return <div className="chart"><div className="bars">
  {vals.map((v,i)=><div className="barwrap" key={i}><div className="bar" style={{height:`${28+((v-min)/(max-min))*68}%`}} title={`${v} KPG`}/></div>)}
 </div><div className="axis"><span>10 games ago</span><span>Recent</span></div></div>
}

function Dashboard({setPage,user}){
 return <div className="page">
  <div className="page-head"><div><div className="eyebrow">PLAYER DASHBOARD</div>
   <h1>{user?.user_metadata?.display_name||user?.user_metadata?.username||'Player'}</h1>
   <p>Here’s your competitive snapshot.</p></div>
   <button className="primary" onClick={()=>setPage('stats')}><BarChart3 size={17}/> View full stats</button>
  </div>
  <div className="demo-note">Demo stats are shown until supported game APIs are connected.</div>
  <div className="stats">
   <Stat icon={Gamepad2} label="Total Games" value="1,842" sub="+24 this week"/>
   <Stat icon={Trophy} label="Win Rate" value="53.6%" sub="+2.1% this month"/>
   <Stat icon={Swords} label="Total Kills" value="12,648" sub="+418 this week"/>
   <Stat icon={Zap} label="Kills / Game" value="6.87" sub="Personal best 9.82"/>
  </div>
  <div className="twocol">
   <section className="panel"><div className="panel-head"><div><h2>Kills per Game</h2><span>Recent performance trend</span></div><span className="pill">+8.4%</span></div><Chart/></section>
   <section className="panel rank"><div className="rank-logo"><Crown size={34}/></div><span className="eyebrow">CURRENT RANK</span><h2>Diamond</h2><div className="progress"><i/></div><div className="progress-label"><span>2,410 XP</span><span>3,250 XP</span></div><div className="streak"><Zap size={17}/> 8 win streak</div></section>
  </div>
  <section className="panel"><div className="panel-head"><div><h2>Game Performance</h2><span>Your strongest games at a glance</span></div><button className="linkbtn" onClick={()=>setPage('stats')}>See all <ChevronRight size={16}/></button></div>
   <div className="gamegrid">{games.map(g=><div className="gamecard" key={g.short}><div className="glogo">{g.short}</div><div><b>{g.name}</b><small>{g.games} games • {g.wins} wins</small></div><div className="kpg"><b>{g.kpg}</b><small>KPG</small></div></div>)}</div>
  </section>
 </div>
}

function Stats(){
 return <div className="page"><div className="page-head"><div><div className="eyebrow">ANALYTICS</div><h1>My Stats</h1><p>Break down performance by game.</p></div></div>
 <div className="stats"><Stat icon={Gamepad2} label="Games Played" value="1,842"/><Stat icon={Trophy} label="Wins" value="988"/><Stat icon={Swords} label="K/D" value="6.87"/><Stat icon={Zap} label="Win Streak" value="8"/></div>
 <section className="panel tablepanel"><div className="panel-head"><h2>Game Breakdown</h2><span>Demo values until live APIs are connected</span></div>
 <div className="tablewrap"><table><thead><tr><th>Game</th><th>Games</th><th>Wins</th><th>Win Rate</th><th>Kills</th><th>KPG</th></tr></thead><tbody>
 {games.map(g=><tr key={g.short}><td><b>{g.name}</b></td><td>{g.games}</td><td>{g.wins}</td><td>{(g.wins/g.games*100).toFixed(1)}%</td><td>{g.kills.toLocaleString()}</td><td className="accent">{g.kpg}</td></tr>)}
 </tbody></table></div></section></div>
}

function Friends(){
 const sorted=useMemo(()=>[...friends].sort((a,b)=>b.kpg-a.kpg),[]);
 return <div className="page"><div className="page-head"><div><div className="eyebrow">SOCIAL</div><h1>Friends</h1><p>Compare stats and see who is dominating.</p></div><button className="primary"><UserPlus size={17}/> Add Friend</button></div>
 <section className="panel"><div className="panel-head"><h2>Friend Leaderboard</h2><span className="pill">KPG</span></div>
 {sorted.map((f,i)=><div className="friend" key={f.name}><span>#{i+1}</span><div className="avatar">{f.name[0]}</div><div><b>{f.name}</b><small>{f.rank} • {f.online?'Online':'Offline'}</small></div><div className="metric"><b>{f.kpg}</b><small>KPG</small></div><div className="metric"><b>{f.wins}</b><small>WINS</small></div></div>)}
 </section></div>
}

function Leaderboard(){
 const rows=[['Nova','Diamond',7.91],['FragLord','Diamond',7.72],['You','Diamond',6.87],['Rogue','Platinum',6.98],['Jett','Diamond',6.81],['Vex','Gold',5.92]];
 return <div className="page"><div className="page-head"><div><div className="eyebrow">COMPETE</div><h1>Global Leaderboard</h1><p>Climb the rankings and prove you belong.</p></div></div>
 <div className="tabs"><button className="active">All Players</button><button>Call of Duty</button><button>Fortnite</button><button>Apex Legends</button></div>
 <section className="panel tablepanel"><div className="tablewrap"><table><thead><tr><th>Rank</th><th>Player</th><th>Tier</th><th>KPG</th><th>Status</th></tr></thead><tbody>
 {rows.map((r,i)=><tr className={r[0]==='You'?'you':''} key={r[0]}><td>#{i+1}</td><td><b>{r[0]}</b></td><td><span className="chip">{r[1]}</span></td><td className="accent">{r[2]}</td><td>{r[0]==='You'?<span className="youpill">YOU</span>:'Ranked'}</td></tr>)}
 </tbody></table></div></section></div>
}

function Achievements(){
 return <div className="page"><div className="page-head"><div><div className="eyebrow">PROGRESSION</div><h1>Achievements</h1><p>Milestones earned across your competitive journey.</p></div><div className="achievement-points"><Award size={17}/> 185 points</div></div>
 <div className="achievement-grid">{achievements.map((a,i)=><div className={`achievement ${i<2?'unlocked':''}`} key={a[0]}><div className="ach-icon"><Award/></div><div><span>{a[2]}</span><h3>{a[0]}</h3><p>{a[1]}</p><b>{a[3]} XP</b></div><strong>{i<2?'✓':'○'}</strong></div>)}</div></div>
}

function Foundation({title,Icon,description}){
 return <div className="page"><div className="page-head"><div><div className="eyebrow">FRAGRANK V2</div><h1>{title}</h1><p>{description}</p></div></div>
 <section className="panel coming"><Icon size={44}/><h2>{title} foundation included</h2><p>The V2 database schema contains the backend tables needed for this feature. The next step is connecting this screen to live Supabase data.</p></section></div>
}

function App(){
 const[session,setSession]=useState(null);
 const[loading,setLoading]=useState(true);
 const[page,setPage]=useState('dashboard');
 const[open,setOpen]=useState(false);

 useEffect(()=>{
   supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
   return()=>subscription.unsubscribe();
 },[]);

 if(loading)return <div className="loading">Loading FragRank…</div>;
 if(!session)return <Auth/>;

 const nav=[
  ['dashboard','Overview',Home],['stats','My Stats',BarChart3],['friends','Friends',Users],
  ['leaderboard','Leaderboard',Globe2],['achievements','Achievements',Award],
  ['challenges','Challenges',Zap],['tournaments','Tournaments',Trophy],
  ['clans','Clans',Shield],['activity','Activity',Activity]
 ];

 const pages={
  dashboard:<Dashboard setPage={setPage} user={session.user}/>,
  stats:<Stats/>,
  friends:<Friends/>,
  leaderboard:<Leaderboard/>,
  achievements:<Achievements/>,
  challenges:<Foundation title="Challenges" Icon={Zap} description="Head-to-head competitive challenges and tracked goals."/>,
  tournaments:<Foundation title="Tournaments" Icon={Trophy} description="Custom tournaments, brackets, and competitive events."/>,
  clans:<Foundation title="Clans" Icon={Shield} description="Teams, clan members, clan stats, chat, and wars."/>,
  activity:<Foundation title="Activity Feed" Icon={Activity} description="Posts, clips, comments, reactions, and player activity."/>
 };

 return <div className="app">
  <aside className={`sidebar ${open?'open':''}`}>
   <div className="side-brand"><div className="mini-mark">F</div><b>FRAGRANK</b><button className="iconbtn close" onClick={()=>setOpen(false)}><X/></button></div>
   <div className="side-tag">TRACK. COMPETE. DOMINATE.</div>
   <nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setOpen(false)}}><Icon size={18}/>{label}</button>)}</nav>
   <div className="spacer"/>
   <div className="mini-profile"><div className="avatar">{(session.user.user_metadata?.display_name||session.user.email||'P')[0].toUpperCase()}</div><div><b>{session.user.user_metadata?.display_name||session.user.user_metadata?.username||'Player'}</b><small>Diamond</small></div></div>
   <button className="logout" onClick={signOut}><LogOut size={17}/> Sign out</button>
  </aside>

  <main className="main">
   <header className="topbar"><button className="iconbtn menu" onClick={()=>setOpen(true)}><Menu/></button><div className="search"><Search size={17}/><input placeholder="Search players, games, clans…"/></div><div className="topactions"><button className="iconbtn"><Bell size={18}/></button><button className="iconbtn"><Settings size={18}/></button></div></header>
   {pages[page]}
  </main>
 </div>
}

createRoot(document.getElementById('root')).render(<App/>);
