import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 核心工具函数 ---
const suits = ['♠', '♥', '♣', '♦'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const valueMap = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const evaluateHand = (cards) => {
  if (cards.length < 2) return { score: 0, name: "计算中" };
  const vList = cards.map(c => valueMap[c.value]).sort((a, b) => b - a);
  const sCounts = {};
  cards.forEach(c => sCounts[c.suit] = (sCounts[c.suit] || 0) + 1);
  const counts = {};
  cards.forEach(c => counts[valueMap[c.value]] = (counts[valueMap[c.value]] || 0) + 1);
  const sortedCounts = Object.entries(counts)
    .map(([val, count]) => ({ val: parseInt(val), count }))
    .sort((a, b) => b.count - a.count || b.val - a.val);
  const flushSuit = Object.keys(sCounts).find(s => sCounts[s] >= 5);
  const flushCards = flushSuit ? cards.filter(c => c.suit === flushSuit).map(c => valueMap[c.value]).sort((a, b) => b - a) : null;
  const getStraightMax = (uniqueValues) => {
    const vals = Array.from(new Set(uniqueValues)).sort((a, b) => b - a);
    if (vals.includes(14)) vals.push(1);
    for (let i = 0; i <= vals.length - 5; i++) {
      if (vals[i] - vals[i + 4] === 4) return vals[i];
    }
    return null;
  };
  const straightMax = getStraightMax(vList);
  const straightFlushMax = flushCards ? getStraightMax(flushCards) : null;

  if (straightFlushMax) {
    if (straightFlushMax === 14) return { score: 900, name: "皇家同花顺" };
    return { score: 800 + straightFlushMax, name: "同花顺" };
  }
  if (sortedCounts[0].count === 4) return { score: 700 + sortedCounts[0].val, name: "四条" };
  if (sortedCounts[0].count === 3 && sortedCounts[1]?.count >= 2) return { score: 600 + sortedCounts[0].val, name: "葫芦" };
  if (flushCards) return { score: 500 + flushCards[0], name: "同花" };
  if (straightMax) return { score: 400 + straightMax, name: "顺子" };
  if (sortedCounts[0].count === 3) return { score: 300 + sortedCounts[0].val, name: "三条" };
  if (sortedCounts[0].count === 2 && sortedCounts[1]?.count === 2) return { score: 200 + sortedCounts[0].val + (sortedCounts[1].val / 15), name: "两对" };
  if (sortedCounts[0].count === 2) return { score: 100 + sortedCounts[0].val, name: "一对" };
  return { score: vList[0], name: "高牌" };
};

export default function App() {
  const [setup, setSetup] = useState({ started: false, count: 3, initialMoney: 1000, smallBlind: 10 });
  const [players, setPlayers] = useState([]);
  const [communityCards, setCommunityCards] = useState([]);
  const [deck, setDeck] = useState([]);
  const [pot, setPot] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [highestBet, setHighestBet] = useState(0);
  const [gamePhase, setGamePhase] = useState('waiting');
  const [winnerInfo, setWinnerInfo] = useState(null);
  const [dealerIndex, setDealerIndex] = useState(0);
  const [raiseAmount, setRaiseAmount] = useState(100);
  const [phaseTip, setPhaseTip] = useState("");
  const [lastAggressor, setLastAggressor] = useState(-1);

  const showTip = (text) => {
    setPhaseTip(text);
    setTimeout(() => setPhaseTip(""), 2000);
  };

  const initGame = (isNewMatch = false) => {
    if (isNewMatch) {
      const personalities = ['aggressive', 'conservative', 'random'];
      const initial = [
        { id: 0, name: "Oswin", money: setup.initialMoney, cards: [], currentBet: 0, isFolded: false, isAI: false, role: "" },
        ...Array.from({ length: setup.count }).map((_, i) => ({
          id: i + 1, name: `机器人 ${i + 1}`, money: setup.initialMoney, cards: [], currentBet: 0, isFolded: false, isAI: true, personality: personalities[i % 3], role: ""
        }))
      ];
      const randomDealer = Math.floor(Math.random() * initial.length);
      setDealerIndex(randomDealer);
      startRound(initial, randomDealer);
    } else {
      const nextDealer = (dealerIndex + 1) % players.length;
      setDealerIndex(nextDealer);
      startRound(players, nextDealer);
    }
  };

  const startRound = (currPlayers, dIdx) => {
    const newDeck = [];
    suits.forEach(s => values.forEach(v => newDeck.push({ suit: s, value: v })));
    const shuffled = newDeck.sort(() => Math.random() - 0.5);
    const sbIdx = (dIdx + 1) % currPlayers.length;
    const bbIdx = (dIdx + 2) % currPlayers.length;
    const utgIdx = (dIdx + 3) % currPlayers.length;
    let ptr = 0;
    const resetPlayers = currPlayers.map((p, idx) => {
      let role = ""; let bet = 0; let money = p.money;
      if (idx === dIdx) role = "庄家 (BTN)";
      if (idx === sbIdx) { role = "小盲 (SB)"; bet = setup.smallBlind; money -= bet; }
      if (idx === bbIdx) { role = "大盲 (BB)"; bet = setup.smallBlind * 2; money -= bet; }
      return { ...p, cards: [shuffled[ptr++], shuffled[ptr++]], currentBet: bet, money: money, isFolded: false, role: role };
    });
    setDeck(shuffled.slice(ptr));
    setCommunityCards([]);
    setPot(setup.smallBlind * 3);
    setHighestBet(setup.smallBlind * 2);
    setWinnerInfo(null);
    setGamePhase('preflop');
    setPlayers(resetPlayers);
    setLastAggressor(bbIdx);
    setCurrentTurn(utgIdx);
  };

  const handleAction = (playerId, type, amount = 0) => {
    if (['showdown', 'gameOver', 'calculating_end'].includes(gamePhase)) return;
    let newPlayers = [...players];
    const p = newPlayers[playerId];
    if (type === 'fold') p.isFolded = true;
    else if (type === 'call') {
      const diff = highestBet - p.currentBet;
      const move = Math.min(diff, p.money);
      p.money -= move; p.currentBet += move; setPot(prev => prev + move);
    } else if (type === 'raise') {
      const total = (highestBet - p.currentBet) + amount;
      const move = Math.min(total, p.money);
      p.money -= move; p.currentBet += move; setHighestBet(p.currentBet); setPot(prev => prev + move);
      setLastAggressor(playerId);
    } else if (type === 'allin') {
      const move = p.money; p.money = 0; p.currentBet += move;
      if (p.currentBet > highestBet) { setHighestBet(p.currentBet); setLastAggressor(playerId); }
      setPot(prev => prev + move);
    }
    setPlayers(newPlayers);
    checkNext(newPlayers, playerId);
  };

  const checkNext = (curr, lastId) => {
    const active = curr.filter(p => !p.isFolded);
    if (active.length === 1) return endRound(active[0].id, "对手弃牌");

    const needToAct = active.filter(p => p.money > 0);
    if (needToAct.length <= 1 && active.every(p => p.money === 0 || p.currentBet === highestBet)) {
      setTimeout(() => advancePhase(curr), 600);
      return;
    }

    let next = (lastId + 1) % curr.length;
    while (curr[next].isFolded || (curr[next].money === 0 && curr[next].currentBet === highestBet)) {
      next = (next + 1) % curr.length;
      if (next === lastId) break;
    }

    const allMatched = curr.every(p => p.isFolded || p.money === 0 || p.currentBet === highestBet);
    const nextIsAggressor = next === lastAggressor;
    const isEndOfCheckRound = highestBet === 0 && lastId === dealerIndex;

    if (allMatched && (nextIsAggressor || isEndOfCheckRound)) {
      setTimeout(() => advancePhase(curr), 600);
    } else {
      setCurrentTurn(next);
    }
  };

  // --- 强制跳过/推进功能 ---
  const forceAdvance = () => {
    showTip("强制推进中...");
    const allMatched = players.every(p => p.isFolded || p.money === 0 || p.currentBet === highestBet);
    if (allMatched) {
      advancePhase(players);
    } else {
      checkNext(players, currentTurn);
    }
  };

  function advancePhase(curr) {
    if (['showdown', 'gameOver', 'calculating_end'].includes(gamePhase)) return;
    const active = curr.filter(p => !p.isFolded);
    const needToAct = active.filter(p => p.money > 0);
    const isFastForward = needToAct.length <= 1;

    const resetPlayers = curr.map(p => ({ ...p, currentBet: 0 }));
    setHighestBet(0);
    setPlayers(resetPlayers);
    setLastAggressor((dealerIndex + 1) % curr.length);

    let nextStarter = (dealerIndex + 1) % curr.length;
    while (curr[nextStarter].isFolded) nextStarter = (nextStarter + 1) % curr.length;
    setCurrentTurn(nextStarter);

    if (gamePhase === 'preflop') {
      setCommunityCards(deck.slice(0, 3));
      setGamePhase('flop');
      showTip("FLOP");
      if (isFastForward) setTimeout(() => advancePhase(resetPlayers), 1000);
    } else if (gamePhase === 'flop') {
      setCommunityCards(deck.slice(0, 4));
      setGamePhase('turn');
      showTip("TURN");
      if (isFastForward) setTimeout(() => advancePhase(resetPlayers), 1000);
    } else if (gamePhase === 'turn') {
      setCommunityCards(deck.slice(0, 5));
      setGamePhase('river');
      showTip("RIVER");
      if (isFastForward) setTimeout(() => advancePhase(resetPlayers), 1000);
    } else if (gamePhase === 'river') {
      const results = curr.filter(p => !p.isFolded).map(p => ({
        id: p.id,
        res: evaluateHand([...p.cards, ...communityCards])
      }));
      const winner = results.sort((a, b) => b.res.score - a.res.score)[0];
      endRound(winner.id, winner.res.name);
    }
  }

  const endRound = (wid, handName = "获胜") => {
    const updatedPlayers = players.map(p => p.id === wid ? { ...p, money: p.money + pot } : p);
    setPlayers(updatedPlayers);
    setWinnerInfo({ name: players[wid].name, hand: handName });
    const hasBankrupt = updatedPlayers.some(p => p.money <= 0);
    if (hasBankrupt) {
      setGamePhase('calculating_end');
      setTimeout(() => setGamePhase('gameOver'), 2000);
    } else {
      setGamePhase('showdown');
    }
  };

  useEffect(() => {
    const p = players[currentTurn];
    if (setup.started && p?.isAI && !['showdown', 'gameOver', 'calculating_end'].includes(gamePhase)) {
      if (p.money > 0 && !p.isFolded) {
        const timer = setTimeout(() => {
          const hand = evaluateHand([...p.cards, ...communityCards]);
          const confidence = Math.random();
          const toCall = highestBet - p.currentBet;
          if (p.personality === 'aggressive') {
            if (hand.score > 300 || confidence > 0.7) handleAction(p.id, 'raise', 100);
            else handleAction(p.id, 'call');
          } else if (p.personality === 'conservative') {
            if (toCall > p.money * 0.3 && hand.score < 200) handleAction(p.id, 'fold');
            else if (hand.score > 500) handleAction(p.id, 'raise', 50);
            else handleAction(p.id, 'call');
          } else {
            if (confidence > 0.9) handleAction(p.id, 'allin');
            else if (confidence > 0.4) handleAction(p.id, 'call');
            else handleAction(p.id, 'fold');
          }
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [currentTurn, gamePhase, highestBet, communityCards, players, setup.started]);

  const MiniCard = ({ card, hidden }) => (
    <div className={`w-10 h-14 bg-white text-black rounded-lg flex flex-col items-center justify-center font-bold shadow-md border ${hidden ? 'bg-indigo-900' : ''}`}>
      {hidden ? <div className="text-white text-[8px] text-center opacity-30 italic">POKER</div> : (
        <>
          <span className={card.suit === '♥' || card.suit === '♦' ? 'text-red-600 text-[10px]' : 'text-[10px]'}>{card.value}</span>
          <span className={card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : ''}>{card.suit}</span>
        </>
      )}
    </div>
  );

  if (!setup.started) return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
      <h1 className="text-6xl font-black text-emerald-500 mb-8 italic text-center">POKERWOMAN GO</h1>
      <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 w-full max-w-md shadow-2xl">
        <label className="text-sm font-bold text-slate-400 block mb-2">对手数量 (1-5)</label>
        <input type="range" min="1" max="5" value={setup.count} onChange={e => setSetup({ ...setup, count: parseInt(e.target.value) })} className="w-full mb-6 accent-emerald-500" />
        <label className="text-sm font-bold text-slate-400 block mb-2">初始筹码: ${setup.initialMoney}</label>
        <input type="range" min="500" max="10000" step="500" value={setup.initialMoney} onChange={e => setSetup({ ...setup, initialMoney: parseInt(e.target.value) })} className="w-full mb-8 accent-emerald-500" />
        <button onClick={() => { setSetup({ ...setup, started: true }); initGame(true); }} className="w-full bg-emerald-600 hover:bg-emerald-500 py-4 rounded-xl font-black text-xl transition-all shadow-lg text-white">进入牌局</button>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-slate-950 text-white overflow-hidden relative font-sans">
      <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 z-50 min-w-[160px]">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Rankings</p>
        {[...players].sort((a, b) => b.money - a.money).map(p => (
          <div key={p.id} className="flex justify-between text-xs mb-1">
            <span className={p.id === 0 ? "text-emerald-400 font-bold" : "opacity-60"}>{p.name}</span>
            <span className="font-mono">${p.money}</span>
          </div>
        ))}
      </div>

      {/* 强制推进按钮 - 只有在等待且非玩家回合时显示 */}
      {currentTurn !== 0 && !['showdown', 'gameOver'].includes(gamePhase) && (
        <button 
          onClick={forceAdvance}
          className="absolute top-4 left-4 bg-red-600/80 hover:bg-red-500 text-white px-4 py-2 rounded-full text-[10px] font-black z-50 animate-pulse border border-white/20"
        >
          逻辑卡死？点击强制发牌
        </button>
      )}

      <div className="h-full w-full flex flex-col items-center justify-between py-8 scale-[0.9] origin-top transition-transform duration-300">
        <div className="flex gap-8">
          {players.filter(p => p.id !== 0).map(p => (
            <div key={p.id} className={`flex flex-col items-center transition-all ${p.isFolded ? 'opacity-20 grayscale' : ''}`}>
              <div className={`p-2 rounded-xl border-2 mb-2 ${currentTurn === p.id ? 'border-emerald-400 bg-emerald-900/20 shadow-[0_0_20px_rgba(52,211,153,0.2)]' : 'border-white/10'}`}>
                <div className="flex gap-1 mb-1">
                  <MiniCard card={p.cards[0]} hidden={gamePhase !== 'showdown' && gamePhase !== 'gameOver'} />
                  <MiniCard card={p.cards[1]} hidden={gamePhase !== 'showdown' && gamePhase !== 'gameOver'} />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-emerald-400">{p.role}</p>
                  <p className="text-xs font-bold">{p.name}</p>
                  <p className="text-[10px] text-yellow-500 font-mono">Bet: ${p.currentBet}</p>
                  {p.money === 0 && !p.isFolded && <p className="text-[8px] bg-red-600 rounded px-1 mt-1 font-bold">ALL IN</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative w-[85%] max-w-4xl aspect-[2/1] bg-emerald-950 rounded-[200px] border-[12px] border-amber-950 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center">
          <div className="bg-black/30 px-6 py-2 rounded-full border border-white/10 text-yellow-400 font-mono text-2xl mb-8">POT: ${pot}</div>
          <div className="flex gap-3">
            {communityCards.map((c, i) => (
              <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-24 bg-white text-black rounded-xl flex flex-col items-center justify-center font-bold text-2xl shadow-xl">
                <span className={c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}>{c.value}</span>
                <span className={c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}>{c.suit}</span>
              </motion.div>
            ))}
            {[...Array(5 - communityCards.length)].map((_, i) => (
              <div key={i} className="w-16 h-24 rounded-xl border-2 border-white/5 bg-black/10" />
            ))}
          </div>

          <AnimatePresence>
            {phaseTip && (
              <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="absolute left-10 top-1/2 -translate-y-1/2 z-[150] pointer-events-none">
                <div className="bg-emerald-500 px-6 py-3 rounded-2xl shadow-2xl">
                  <span className="text-xl font-black text-white italic tracking-tighter uppercase">{phaseTip}</span>
                </div>
              </motion.div>
            )}
            {winnerInfo && gamePhase !== 'gameOver' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 flex items-center justify-center z-[100] pointer-events-none">
                <div className="bg-black/95 p-8 rounded-3xl border border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.3)] text-center backdrop-blur-md">
                  <p className="text-yellow-500 font-black tracking-tighter uppercase mb-1">Winner</p>
                  <h2 className="text-4xl font-black mb-2 text-white">{winnerInfo.name}</h2>
                  <p className="text-emerald-400 font-bold">{winnerInfo.hand}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-center w-full px-10">
          <div className="flex gap-6 mb-4 items-end">
            <div className={`p-4 rounded-3xl border-4 transition-all ${currentTurn === 0 && !['showdown', 'gameOver'].includes(gamePhase) ? 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.3)] bg-slate-900' : 'border-white/10'}`}>
              <div className="flex gap-4 mb-3">
                {players[0]?.cards.map((c, i) => (
                  <div key={i} className="w-24 h-36 bg-white text-black rounded-2xl flex flex-col items-center justify-center font-bold text-4xl shadow-2xl">
                    <span className={c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}>{c.value}</span>
                    <span className={c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}>{c.suit}</span>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <span className="bg-emerald-600 px-3 py-1 rounded-full text-[10px] font-black mr-2 uppercase">{players[0]?.role}</span>
                <span className="font-black text-xl">CHIPS: ${players[0]?.money}</span>
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-xl p-6 rounded-[40px] border border-white/10 flex items-center gap-6 h-fit shadow-2xl">
              {gamePhase === 'showdown' ? (
                <button onClick={() => initGame()} className="bg-yellow-500 hover:bg-yellow-400 text-black px-12 py-4 rounded-2xl font-black text-2xl transition-all shadow-lg">NEXT ROUND</button>
              ) : gamePhase === 'gameOver' ? (
                <div className="px-16 py-4 text-emerald-500 font-bold italic uppercase tracking-widest">Game Over</div>
              ) : (currentTurn === 0 && players[0]?.money > 0) ? (
                <>
                  <button onClick={() => handleAction(0, 'fold')} className="text-slate-400 hover:text-white font-bold px-4">FOLD</button>
                  <button onClick={() => handleAction(0, 'call')} className="bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-2xl font-black shadow-lg min-w-[140px] text-white">
                    {highestBet === 0 ? "CHECK" : `CALL $${highestBet - players[0].currentBet}`}
                  </button>
                  <div className="h-12 w-px bg-white/10" />
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-xs">$</span>
                      <input type="number" min="10" max={players[0].money} step="10" value={raiseAmount} onChange={e => setRaiseAmount(Math.min(parseInt(e.target.value) || 0, players[0].money))} className="w-28 bg-slate-800 border border-white/10 rounded-xl py-2 pl-7 pr-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAction(0, 'raise', raiseAmount)} className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl text-[10px] font-black text-white flex-1">RAISE</button>
                      <button onClick={() => handleAction(0, 'allin')} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl text-[10px] font-black text-white flex-1">ALL IN</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="px-16 py-4 text-slate-500 font-bold italic animate-pulse uppercase tracking-widest">Waiting...</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {gamePhase === 'gameOver' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl">
          <div className="bg-slate-900 p-10 rounded-[40px] border-2 border-emerald-500 shadow-2xl text-center max-w-md w-full mx-4">
            <h2 className="text-5xl font-black text-emerald-500 mb-2 italic">POKERWOMAN</h2>
            <p className="text-slate-400 mb-8 font-bold uppercase tracking-widest">Final Leaderboard</p>
            <div className="space-y-3 mb-10">
              {[...players].sort((a, b) => b.money - a.money).map((p, i) => (
                <div key={p.id} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                  <span className="text-xl font-bold text-slate-500 w-8">{i + 1}</span>
                  <span className={`flex-1 text-left px-4 font-bold ${p.id === 0 ? 'text-emerald-400' : 'text-white'}`}>{p.name}</span>
                  <span className="font-mono text-xl text-yellow-500">${p.money}</span>
                </div>
              ))}
            </div>
            <button onClick={() => window.location.reload()} className="w-full bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-black text-xl transition-all shadow-xl text-white">RESTART</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}