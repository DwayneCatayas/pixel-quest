'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';

const ACHIEVEMENT_LIST = [
  { name: 'NOVICE HERO', desc: 'Join PixelQuest' },
  { name: 'FIRST QUEST', desc: 'Complete 1 Task' },
  { name: 'TASK MASTER', desc: 'Complete 3 Tasks' },
  { name: 'XP HUNTER', desc: 'Earn 200 Total XP' },
  { name: 'RISING STAR', desc: 'Reach Level 5' },
  { name: 'LEGENDARY HERO', desc: 'Reach Level 50' },
];

export default function PixelQuestApp() {
  const [screen, setScreen] = useState('landing');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [quests, setQuests] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [activityLog, setActivityLog] = useState('Ready for your next quest!');
  const [newStats, setNewStats] = useState('');
  const [isEditingStats, setIsEditingStats] = useState(false);

  const fetchPlayerData = async (userId) => {
    let { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Auto-create profile row if missing so quests never fail foreign-key checks
    if (!profileData) {
      const { data: createdProfile } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            username: username || email.split('@')[0] || 'Player',
            level: 1,
            xp: 0,
            stats: 'Class: Adventurer | Motto: Stay productive!',
          },
        ])
        .select()
        .single();
      profileData = createdProfile;
    }

    if (profileData) {
      setProfile(profileData);
      setNewStats(profileData.stats);
    }

    const { data: questData } = await supabase
      .from('quests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (questData) setQuests(questData);

    const { data: badgeData } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId);

    if (badgeData) setAchievements(badgeData);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return setAuthError(error.message);

    if (data.user) {
      await supabase.from('profiles').insert([
        {
          id: data.user.id,
          username: username || email.split('@')[0],
          level: 1,
          xp: 0,
          stats: 'Class: Adventurer | Motto: Stay productive!',
        },
      ]);

      await supabase.from('achievements').insert([
        { user_id: data.user.id, badge_name: 'NOVICE HERO' },
      ]);

      setUser(data.user);
      await fetchPlayerData(data.user.id);
      setScreen('welcome');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setAuthError(error.message);

    if (data.user) {
      setUser(data.user);
      await fetchPlayerData(data.user.id);
      setScreen('welcome');
    }
  };

  // Fixed: Works both on Form Submit (Enter) AND Button Click
  const handleAddQuest = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!newQuestTitle.trim()) {
      setActivityLog('Type a task name in the box first!');
      return;
    }
    if (!user) {
      setActivityLog('Session expired. Please log in again.');
      return;
    }

    const { data, error } = await supabase
      .from('quests')
      .insert([{ user_id: user.id, title: newQuestTitle.trim(), xp_reward: 40 }])
      .select();

    if (error) {
      setActivityLog(`Error adding task: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      setQuests((prev) => [...prev, data[0]]);
      setNewQuestTitle('');
      setActivityLog(`New Quest Added: "${data[0].title}" (+40 XP)`);
    }
  };

  const handleCompleteQuest = async (quest) => {
    if (quest.is_completed) return;

    const { error } = await supabase
      .from('quests')
      .update({ is_completed: true })
      .eq('id', quest.id);

    if (error) {
      setActivityLog(`Error completing task: ${error.message}`);
      return;
    }

    const earnedXp = quest.xp_reward || 40;
    const updatedXp = (profile?.xp || 0) + earnedXp;
    const updatedLevel = Math.floor(updatedXp / 100) + 1;
    const leveledUp = updatedLevel > (profile?.level || 1);

    await supabase
      .from('profiles')
      .update({ xp: updatedXp, level: updatedLevel })
      .eq('id', user.id);

    if (leveledUp) {
      setActivityLog(`You completed a task +${earnedXp}xp! LEVEL UP! You are now Level ${updatedLevel}!`);
    } else {
      setActivityLog(`You completed a task +${earnedXp}xp!`);
    }

    const completedCount = quests.filter((q) => q.is_completed).length + 1;
    const unlockedNames = achievements.map((a) => a.badge_name);
    const newBadges = [];

    if (completedCount >= 1 && !unlockedNames.includes('FIRST QUEST')) {
      newBadges.push({ user_id: user.id, badge_name: 'FIRST QUEST' });
    }
    if (completedCount >= 3 && !unlockedNames.includes('TASK MASTER')) {
      newBadges.push({ user_id: user.id, badge_name: 'TASK MASTER' });
    }
    if (updatedXp >= 200 && !unlockedNames.includes('XP HUNTER')) {
      newBadges.push({ user_id: user.id, badge_name: 'XP HUNTER' });
    }
    if (updatedLevel >= 5 && !unlockedNames.includes('RISING STAR')) {
      newBadges.push({ user_id: user.id, badge_name: 'RISING STAR' });
    }
    if (updatedLevel >= 50 && !unlockedNames.includes('LEGENDARY HERO')) {
      newBadges.push({ user_id: user.id, badge_name: 'LEGENDARY HERO' });
    }

    if (newBadges.length > 0) {
      await supabase.from('achievements').insert(newBadges);
    }

    await fetchPlayerData(user.id);
  };

  const handleUpdateStats = async () => {
    if (!isEditingStats) {
      setIsEditingStats(true);
      return;
    }
    await supabase.from('profiles').update({ stats: newStats }).eq('id', user.id);
    setIsEditingStats(false);
    setActivityLog('Player stats updated!');
    await fetchPlayerData(user.id);
  };

  // Fixed: Deletes completed tasks first, or deletes newest task
  const handleClearTasks = async () => {
    if (quests.length === 0) {
      setActivityLog('No tasks to delete!');
      return;
    }

    const completedIds = quests.filter((q) => q.is_completed).map((q) => q.id);

    if (completedIds.length > 0) {
      const { error } = await supabase.from('quests').delete().in('id', completedIds);
      if (error) {
        setActivityLog(`Delete error: ${error.message}`);
        return;
      }
      setActivityLog(`Cleared ${completedIds.length} completed task(s)!`);
    } else {
      const lastQuest = quests[quests.length - 1];
      const { error } = await supabase.from('quests').delete().eq('id', lastQuest.id);
      if (error) {
        setActivityLog(`Delete error: ${error.message}`);
        return;
      }
      setActivityLog(`Deleted task: "${lastQuest.title}"`);
    }

    await fetchPlayerData(user.id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setQuests([]);
    setAchievements([]);
    setScreen('landing');
  };

  const currentXpInLevel = (profile?.xp || 0) % 100;
  const completedTasksTotal = quests.filter((q) => q.is_completed).length;

  if (screen === 'landing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-2xl h-72 bg-[#D9D9D9] flex flex-col items-center justify-center mb-10 rounded-2xl p-6 text-center">
          <p className="text-2xl mb-4">PIXEL QUEST</p>
          <p className="text-xs text-gray-700">GAMIFIED TASK RPG</p>
        </div>
        <button
          onClick={() => setScreen('login')}
          className="w-80 py-5 mb-5 bg-[#469B58] hover:bg-[#3a8249] text-black text-lg rounded-2xl transition cursor-pointer"
        >
          Log in
        </button>
        <button
          onClick={() => setScreen('signup')}
          className="w-80 py-5 bg-[#469B58] hover:bg-[#3a8249] text-black text-lg rounded-2xl transition cursor-pointer"
        >
          Sign up
        </button>
      </div>
    );
  }

  if (screen === 'login') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <h1 className="text-3xl mb-8 text-center">LOG IN ACCOUNT</h1>
        <form onSubmit={handleLogin} className="w-full max-w-md bg-[#D9D9D9] p-8 rounded-2xl flex flex-col gap-6">
          <div className="bg-[#A6A6A6] p-4 rounded-xl">
            <label className="block text-[10px] mb-2">ENTER EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent outline-none text-xs"
            />
          </div>
          <div className="bg-[#A6A6A6] p-4 rounded-xl">
            <label className="block text-[10px] mb-2">ENTER PASSWORD</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent outline-none text-xs"
            />
          </div>
          {authError && <p className="text-red-600 text-[10px]">{authError}</p>}
          <button type="submit" className="w-48 mx-auto py-4 bg-[#5BB247] hover:bg-[#4ea03c] text-white text-sm rounded-2xl cursor-pointer">
            LOG IN
          </button>
          <button type="button" onClick={() => setScreen('landing')} className="text-[10px] underline cursor-pointer">
            Back
          </button>
        </form>
      </div>
    );
  }

  if (screen === 'signup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <h1 className="text-3xl mb-8 text-center">CREATE YOUR ACCOUNT</h1>
        <form onSubmit={handleSignUp} className="w-full max-w-md bg-[#D9D9D9] p-8 rounded-2xl flex flex-col gap-5">
          <div className="bg-[#7F7F7F] text-white p-4 rounded-xl">
            <label className="block text-[10px] mb-2">ENTER EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent outline-none text-xs"
            />
          </div>
          <div className="bg-[#7F7F7F] text-white p-4 rounded-xl">
            <label className="block text-[10px] mb-2">ENTER USERNAME</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-transparent outline-none text-xs"
            />
          </div>
          <div className="bg-[#7F7F7F] text-white p-4 rounded-xl">
            <label className="block text-[10px] mb-2">ENTER PASSWORD</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent outline-none text-xs"
            />
          </div>
          {authError && <p className="text-red-600 text-[10px]">{authError}</p>}
          <button type="submit" className="w-48 mx-auto py-4 bg-[#45A049] hover:bg-[#3a8b3e] text-white text-sm rounded-2xl cursor-pointer">
            SUBMIT
          </button>
          <button type="button" onClick={() => setScreen('landing')} className="text-[10px] underline cursor-pointer">
            Back
          </button>
        </form>
      </div>
    );
  }

  if (screen === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <h1 className="text-3xl mb-8 text-center">WELCOME TO PIXELQUEST</h1>
        <div className="w-full max-w-2xl h-72 bg-[#D9D9D9] flex flex-col items-center justify-center mb-10 rounded-2xl p-6 text-center">
          <p className="text-base mb-4">PLAYER: {profile?.username}</p>
          <p className="text-xs text-gray-700 leading-relaxed">
            Create daily quests, click ✓ to earn +40 XP, level up your hero, and unlock badges!
          </p>
        </div>
        <button
          onClick={() => setScreen('dashboard')}
          className="w-64 py-5 bg-[#45A049] hover:bg-[#38863c] text-white text-base rounded-2xl cursor-pointer"
        >
          START
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* LEFT PANEL: Account Info */}
      <div className="bg-[#D9D9D9] p-6 rounded-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base">Account Info</h2>
            <button
              type="button"
              onClick={handleLogout}
              className="text-[9px] bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded cursor-pointer"
            >
              LOG OUT
            </button>
          </div>

          <p className="text-[10px] mb-2">LEVEL & XP PROGRESS</p>
          <div className="bg-[#9E9E9E] p-4 rounded-xl mb-6">
            <div className="flex justify-between text-xs mb-2">
              <span>LVL {profile?.level || 1}</span>
              <span>{currentXpInLevel}/100 XP</span>
            </div>
            <div className="w-full bg-gray-700 h-3 rounded-full overflow-hidden">
              <div
                className="bg-[#45A049] h-full transition-all duration-300"
                style={{ width: `${currentXpInLevel}%` }}
              />
            </div>
            <p className="text-[9px] mt-2 text-gray-900">Total XP: {profile?.xp || 0}</p>
          </div>

          <p className="text-[10px] mb-2">STATS</p>
          <div className="bg-[#9E9E9E] p-4 rounded-xl min-h-52 flex flex-col justify-between text-[10px]">
            <div className="bg-[#45A049] text-white p-3 rounded-lg mb-3 leading-relaxed">
              {activityLog}
            </div>

            {isEditingStats ? (
              <textarea
                value={newStats}
                onChange={(e) => setNewStats(e.target.value)}
                className="w-full h-24 bg-white p-2 rounded text-[10px] text-black"
              />
            ) : (
              <div className="space-y-2 leading-relaxed">
                <p>Player: {profile?.username}</p>
                <p>Tasks Done: {completedTasksTotal}</p>
                <p>Badges: {achievements.length} / 6</p>
                <p className="pt-1 border-t border-gray-600">{profile?.stats}</p>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleUpdateStats}
          className="w-full py-4 mt-6 bg-[#4A3B3B] hover:bg-[#382c2c] text-white text-xs rounded-2xl cursor-pointer"
        >
          {isEditingStats ? 'SAVE STATS' : 'UPDATE STATS'}
        </button>
      </div>

      {/* RIGHT PANEL: Achievements/Badges & Daily Task */}
      <div className="md:col-span-2 flex flex-col gap-6">
        <div className="bg-[#D9D9D9] p-6 rounded-2xl">
          <h2 className="text-lg mb-4">Achievements/Badges</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ACHIEVEMENT_LIST.map((item) => {
              const isUnlocked = achievements.some((a) => a.badge_name === item.name);
              return (
                <div
                  key={item.name}
                  className={`p-3 rounded-xl flex flex-col items-center justify-center text-center transition ${
                    isUnlocked
                      ? 'bg-[#F2F5A9] border-2 border-[#45A049] text-black'
                      : 'bg-[#E6E8B8] opacity-55 text-gray-700'
                  }`}
                >
                  <span className="text-[10px] mb-1">
                    {isUnlocked ? `🏆 ${item.name}` : `🔒 ${item.name}`}
                  </span>
                  <span className="text-[8px]">{item.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Task Box */}
        <div className="bg-[#D9D9D9] p-6 rounded-2xl flex-1 flex flex-col justify-between">
          <div>
            <h2 className="text-lg mb-4">Daily task</h2>

            <form onSubmit={handleAddQuest} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="e.g. Score 50 points in this exam..."
                value={newQuestTitle}
                onChange={(e) => setNewQuestTitle(e.target.value)}
                className="flex-1 bg-white px-4 py-3 rounded-xl text-xs outline-none"
              />
            </form>

            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
              {quests.length === 0 && (
                <p className="text-[10px] text-gray-600 text-center py-6">
                  No tasks yet. Type a quest above and click ADD NEW TASK!
                </p>
              )}
              {quests.map((quest) => (
                <div
                  key={quest.id}
                  className={`p-4 rounded-xl flex items-center justify-between transition-colors ${
                    quest.is_completed
                      ? 'bg-[#45A049] text-white'
                      : 'bg-[#B5BD5B] text-black'
                  }`}
                >
                  <span className={`text-xs ${quest.is_completed ? 'line-through' : ''}`}>
                    {quest.title} (+{quest.xp_reward || 40} XP)
                  </span>

                  <button
                    type="button"
                    onClick={() => handleCompleteQuest(quest)}
                    disabled={quest.is_completed}
                    title={quest.is_completed ? 'Completed!' : 'Complete Task (+40 XP)'}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
                      quest.is_completed
                        ? 'bg-[#2E7D32] text-white cursor-default'
                        : 'bg-white/80 hover:bg-[#45A049] hover:text-white text-black'
                    }`}
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <button
              type="button"
              onClick={handleAddQuest}
              className="flex-1 py-4 bg-[#3E7B27] hover:bg-[#31631f] text-white text-xs rounded-2xl cursor-pointer"
            >
              ADD NEW TASK
            </button>
            <button
              type="button"
              onClick={handleClearTasks}
              className="flex-1 py-4 bg-[#5C4444] hover:bg-[#473434] text-white text-xs rounded-2xl cursor-pointer"
            >
              CLEAR/DELETE TASK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}