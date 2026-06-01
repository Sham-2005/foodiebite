import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, Trash2, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AppLayout from '../components/AppLayout';
import { C } from '../components/UI';
import { getWeatherContext } from '../services/weather';

const QUICK_PROMPTS = [
  'Suggest a high-protein Indian breakfast',
  'Create a balanced vegetarian meal plan for summer',
  'Estimate calories for Palak Paneer and Roti',
  'Is Ghee healthy for daily cooking?'
];

const EXPERT_RESPONSES = {
  'suggest a high-protein indian breakfast': 
    'Here are 3 excellent Indian breakfast options rich in protein, perfect for your goals:\n\n' +
    '1. **Paneer Bhurji with Tandoori Roti** 🧀\n' +
    '   - *Macros*: 18g Protein · 280 kcal\n' +
    '   - Cooked with onions, tomatoes, green chilies, and turmeric. Pair it with 1 wheat roti.\n\n' +
    '2. **Moong Dal Chilla (Sprouted Lentil Crepes)** 🌱\n' +
    '   - *Macros*: 12g Protein · 190 kcal\n' +
    '   - Stuffed with grated low-fat paneer and fresh spinach. Rich in fiber and iron.\n\n' +
    '3. **Sprouted Chana & Peanut Salad** 🥗\n' +
    '   - *Macros*: 14g Protein · 220 kcal\n' +
    '   - Tossed with lemon juice, cucumber, and chat masala. Extremely filling and raw.',

  'create a balanced vegetarian meal plan for summer':
    'Here is a light, cooling, and highly nutritious summer meal plan designed for you:\n\n' +
    '☀️ **Breakfast (8:00 AM)**\n' +
    '   - Steamed Idli (3 pcs) with Tomato Chutney & Sambhar (160 kcal, 4g Protein).\n' +
    '   - Very light on the stomach, high in digestible carbs.\n\n' +
    '🌤️ **Lunch (1:00 PM)**\n' +
    '   - Dal Tadka (1 bowl) + Palak Paneer (1 bowl) + 1 Tandoori Roti + Cucumber Raita (1 cup).\n' +
    '   - *Total*: ~460 kcal. Packed with protein, active probiotics, and calcium.\n\n' +
    '🌇 **Evening Snack (4:30 PM)**\n' +
    '   - Fresh Cucumber Salad or Watermelon slices (80 kcal) + Unsweetened Green Tea.\n\n' +
    '🌙 **Dinner (8:00 PM)**\n' +
    '   - Tofu Green Salad (140 kcal, 10g Protein) or Moong Dal Soup.\n' +
    '   - Low-carb and ensures high-quality sleep without indigestion.',

  'estimate calories for palak paneer and roti':
    'Here is the complete Atwater-estimated nutritional breakdown for a Palak Paneer and Roti meal:\n\n' +
    '🍲 **Palak Paneer (250g)**\n' +
    '   - *Calories*: **220 kcal**\n' +
    '   - *Macros*: 10g Protein · 8g Carbs · 16g Fat\n' +
    '   - *Key benefits*: Loaded with Iron, Vitamin A, and high-quality milk proteins.\n\n' +
    '🫓 **Tandoori Roti (Whole Wheat - 45g)**\n' +
    '   - *Calories*: **110 kcal**\n' +
    '   - *Macros*: 3.5g Protein · 22g Carbs · 0.5g Fat\n' +
    '   - *Key benefits*: 100% whole grain fiber, keeps blood sugar stable.\n\n' +
    '📊 **Meal Total**: **330 kcal** with **13.5g of Protein**! This is a highly balanced, low-glycemic, and healthy lunch option.',

  'is ghee healthy for daily cooking?':
    'Yes, Desi Ghee (clarified butter) is highly beneficial when consumed in moderation (1-2 teaspoons daily):\n\n' +
    '✅ **Key Benefits**:\n' +
    '   - **High Smoke Point**: Doesn\'t break down into harmful free radicals at high cooking temperatures.\n' +
    '   - **Digestive Aid**: Rich in Butyric acid, which nourishes gut cells and reduces inflammation.\n' +
    '   - **Healthy Fats**: Contains medium-chain fatty acids that help absorb fat-soluble vitamins (A, D, E, K).\n\n' +
    '⚠️ **Precaution**: Since Ghee is pure fat (1 tsp = ~45 kcal), excessive consumption can lead to caloric surplus. Include it in your daily cooking as a healthy taste enhancer!'
};

export default function AIScreen() {
  const { preferences, user } = useApp();
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [weather, setWeather] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: `Hello ${user?.name || 'there'}! I am your FoodieBite AI Health & Wellness Coach. 🤖\n\nI can build customized meal plans, calculate macros, and suggest high-protein alternatives. Ask me anything!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const chatEndRef = useRef(null);

  useEffect(() => {
    getWeatherContext().then(data => setWeather(data)).catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function handleSend(textToSend) {
    const text = textToSend || query;
    if (!text.trim()) return;

    // Add user message
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setIsTyping(true);

    // AI Response Simulation
    setTimeout(() => {
      let responseText = '';
      const cleanInput = text.toLowerCase().trim().replace(/[?.]/g, '');
      const diet = preferences.dietType || 'Vegetarian';
      const locationName = weather?.location?.label || 'your location';
      const spice = preferences.spiceLevel || 'Medium';
      const goalsText = (preferences.healthGoals || []).map(g => g.replace(/_/g, ' ')).join(', ');

      if (cleanInput.includes('breakfast')) {
        if (diet === 'Vegan') {
          responseText = `As a **Vegan**, here are 3 excellent high-protein Indian breakfast options:\n\n` +
            `1. **Scrambled Tofu Toast** 🌱\n` +
            `   - *Macros*: 16g Protein · 240 kcal\n` +
            `   - Spiced with turmeric, cumin, and black salt, served on toasted whole wheat bread.\n\n` +
            `2. **Moong Dal Chilla** 🥞\n` +
            `   - *Macros*: 12g Protein · 190 kcal\n` +
            `   - Steamed sprouted lentil crepes stuffed with fresh spinach and grated vegan cheese.\n\n` +
            `3. **Almond Milk Chia Seed Pudding** 🥥\n` +
            `   - *Macros*: 14g Protein · 210 kcal\n` +
            `   - Soaked with chia seeds, soy protein powder, and topped with dry almonds.`;
        } else if (diet === 'Non-Vegetarian' || diet === 'Non Vegetarian') {
          responseText = `As a **Non-Vegetarian**, here are 3 highly nutritious, high-protein breakfast options:\n\n` +
            `1. **Egg White Omelette with Whole Wheat Toast** 🍳\n` +
            `   - *Macros*: 22g Protein · 250 kcal\n` +
            `   - Made with 4 egg whites, onions, spinach, and bell peppers. Pair with 1 slice of wheat bread.\n\n` +
            `2. **Chicken Keema Bhurji** 🐔\n` +
            `   - *Macros*: 26g Protein · 280 kcal\n` +
            `   - Lean minced chicken breast cooked with dry spices, tomatoes, and fresh coriander.\n\n` +
            `3. **Paneer Tikka Roll** 🌯\n` +
            `   - *Macros*: 18g Protein · 280 kcal\n` +
            `   - Hand-crafted spiced paneer cubes wrapped in a high-fiber whole wheat chapati.`;
        } else if (diet === 'Eggetarian') {
          responseText = `As an **Eggetarian**, here are 3 highly nutritious, high-protein breakfast options:\n\n` +
            `1. **Egg White Omelette** 🍳\n` +
            `   - *Macros*: 22g Protein · 250 kcal\n` +
            `   - Made with 4 egg whites, onions, spinach, and bell peppers.\n\n` +
            `2. **Paneer Bhurji with Roti** 🧀\n` +
            `   - *Macros*: 18g Protein · 280 kcal\n` +
            `   - Cottage cheese scrambled with spices and served with a whole wheat roti.\n\n` +
            `3. **Boiled Eggs & Avocado Salad** 🥑\n` +
            `   - *Macros*: 16g Protein · 260 kcal\n` +
            `   - 2 whole boiled eggs tossed with diced avocado, lemon juice, and black pepper.`;
        } else {
          // Vegetarian default
          responseText = `As a **Vegetarian**, here are 3 highly nutritious, high-protein breakfast options:\n\n` +
            `1. **Paneer Bhurji with Tandoori Roti** 🧀\n` +
            `   - *Macros*: 18g Protein · 280 kcal\n` +
            `   - Cottage cheese scrambled with onions, tomatoes, and spices. Served with 1 whole wheat roti.\n\n` +
            `2. **Moong Dal Chilla** 🥞\n` +
            `   - *Macros*: 12g Protein · 190 kcal\n` +
            `   - Sprouted lentil crepes stuffed with grated paneer and chopped spinach.\n\n` +
            `3. **Sprouted Chana & Peanut Salad** 🥗\n` +
            `   - *Macros*: 14g Protein · 220 kcal\n` +
            `   - Sprouted black chickpeas tossed with lemon juice, cucumbers, and roasted peanuts.`;
        }
      } else if (cleanInput.includes('summer') || cleanInput.includes('meal plan')) {
        if (diet === 'Vegan') {
          responseText = `Here is a custom **Vegan Summer Meal Plan** designed to be balanced, cooling, and nutrient-dense:\n\n` +
            `☀️ **Breakfast (8:00 AM)**\n` +
            `   - Steamed Idli (3 pcs) + Sambhar (160 kcal, 4g Protein). Light, oil-free, and highly digestible.\n\n` +
            `🌤️ **Lunch (1:00 PM)**\n` +
            `   - Chana Masala (1 bowl) + Dal Tadka (1 bowl) + 1 Tandoori Roti + Garden Salad.\n` +
            `   - *Macros*: ~390 kcal, rich in plant-based iron and amino acids.\n\n` +
            `🌇 **Snack (4:30 PM)**\n` +
            `   - Fresh Coconut Water + 10 Almonds (120 kcal).\n\n` +
            `🌙 **Dinner (8:00 PM)**\n` +
            `   - Tofu Green Salad (140 kcal, 10g Protein) with light vinaigrette dressing. Highly restorative.`;
        } else if (diet === 'Non-Vegetarian' || diet === 'Non Vegetarian') {
          responseText = `Here is a custom **Non-Vegetarian Summer Meal Plan** designed to keep you cool, lean, and highly energized:\n\n` +
            `☀️ **Breakfast (8:00 AM)**\n` +
            `   - Egg White Omelette with 4 eggs, spinach, and bell peppers (180 kcal, 22g Protein).\n\n` +
            `🌤️ **Lunch (1:00 PM)**\n` +
            `   - Grilled Chicken Tikka (200g) + Dal Tadka (1 bowl) + 1 Tandoori Roti + Cucumber Raita (1 cup).\n` +
            `   - *Macros*: ~510 kcal, rich in muscle-building lean protein and probiotics.\n\n` +
            `🌇 **Snack (4:30 PM)**\n` +
            `   - Diced Watermelon or fresh Coconut Water (80 kcal).\n\n` +
            `🌙 **Dinner (8:00 PM)**\n` +
            `   - Goan Fish Curry (250g) with steamed brown rice (340 kcal). Packed with heart-healthy Omega-3 fats.`;
        } else {
          // Vegetarian & Eggetarian default
          responseText = `Here is a custom **Vegetarian Summer Meal Plan** designed to be light, cooling, and highly nutritious:\n\n` +
            `☀️ **Breakfast (8:00 AM)**\n` +
            `   - Steamed Idli (3 pcs) with Sambhar (160 kcal, 4g Protein). Light and easily digestible.\n\n` +
            `🌤️ **Lunch (1:00 PM)**\n` +
            `   - Palak Paneer (1 bowl) + Dal Tadka (1 bowl) + 1 Tandoori Roti + Cucumber Raita (1 cup).\n` +
            `   - *Macros*: ~510 kcal, high in high-quality milk protein, calcium, and dietary fibers.\n\n` +
            `🌇 **Snack (4:30 PM)**\n` +
            `   - Fresh Coconut Water + 1 cup sliced Cucumber (80 kcal).\n\n` +
            `🌙 **Dinner (8:00 PM)**\n` +
            `   - Tofu Green Salad (140 kcal, 10g Protein) or Moong Dal Soup. Ensures a restorative deep sleep.`;
        }
      } else if (cleanInput.includes('calories') || cleanInput.includes('palak paneer') || cleanInput.includes('roti') || cleanInput.includes('estimate')) {
        if (diet === 'Non-Vegetarian' || diet === 'Non Vegetarian') {
          responseText = `Here is the Atwater-estimated nutritional breakdown for a typical **Chicken Tikka & Roti** lunch:\n\n` +
            `🍗 **Chicken Tikka (200g)**\n` +
            `   - *Calories*: **220 kcal**\n` +
            `   - *Macros*: 26g Protein · 4g Carbs · 10g Fat\n` +
            `   - *Key benefits*: Ultra-lean protein source, rich in Vitamin B6 and Zinc.\n\n` +
            `🫓 **Tandoori Roti (Whole Wheat - 45g)**\n` +
            `   - *Calories*: **110 kcal**\n` +
            `   - *Macros*: 3.5g Protein · 22g Carbs · 0.5g Fat\n` +
            `   - *Key benefits*: High-fiber, prevents spikes in blood sugar.\n\n` +
            `📊 **Meal Total**: **330 kcal** with a spectacular **29.5g of lean Protein**! An elite choice for muscle preservation and fat loss.`;
        } else if (diet === 'Vegan') {
          responseText = `Here is the Atwater-estimated nutritional breakdown for a typical **Tofu Green Salad & Roti** lunch:\n\n` +
            `🥗 **Tofu Green Salad (200g)**\n` +
            `   - *Calories*: **140 kcal**\n` +
            `   - *Macros*: 10g Protein · 8g Carbs · 7g Fat\n` +
            `   - *Key benefits*: 100% plant-based soy protein, low-calorie, rich in potassium.\n\n` +
            `🫓 **Tandoori Roti (Whole Wheat - 45g)**\n` +
            `   - *Calories*: **110 kcal**\n` +
            `   - *Macros*: 3.5g Protein · 22g Carbs · 0.5g Fat\n` +
            `   - *Key benefits*: Complex carbs, keeps you full for hours.\n\n` +
            `📊 **Meal Total**: **250 kcal** with **13.5g of Protein**! An exceptionally light, fat-burning, and heart-healthy vegan meal.`;
        } else {
          // Vegetarian default
          responseText = `Here is the Atwater-estimated nutritional breakdown for a typical **Palak Paneer & Roti** lunch:\n\n` +
            `🍲 **Palak Paneer (250g)**\n` +
            `   - *Calories*: **220 kcal**\n` +
            `   - *Macros*: 10g Protein · 8g Carbs · 16g Fat\n` +
            `   - *Key benefits*: Loaded with iron, folic acid, and dairy calcium.\n\n` +
            `🫓 **Tandoori Roti (Whole Wheat - 45g)**\n` +
            `   - *Calories*: **110 kcal**\n` +
            `   - *Macros*: 3.5g Protein · 22g Carbs · 0.5g Fat\n` +
            `   - *Key benefits*: Fiber-dense, low glycemic index.\n\n` +
            `📊 **Meal Total**: **330 kcal** with **13.5g of Protein**! A highly balanced, traditional, and healthy Indian lunch option.`;
        }
      } else if (cleanInput.includes('ghee') || cleanInput.includes('cooking')) {
        responseText = `Yes, Desi Ghee (clarified butter) is highly beneficial when consumed in moderation (1-2 teaspoons daily):\n\n` +
          `✅ **Key Benefits**:\n` +
          `   - **High Smoke Point**: Doesn\'t break down into harmful free radicals at high cooking temperatures.\n` +
          `   - **Digestive Aid**: Rich in Butyric acid, which nourishes gut cells and reduces inflammation.\n` +
          `   - **Healthy Fats**: Contains medium-chain fatty acids that help absorb fat-soluble vitamins (A, D, E, K).\n\n` +
          `⚠️ **Precaution**: Since Ghee is pure fat (1 tsp = ~45 kcal), excessive consumption can lead to caloric surplus. Include it in your daily cooking as a healthy taste enhancer!`;
      } else {
        // Dynamic Response based on user profile and weather location
        responseText = `That is a great question! Based on your profile as a **${diet}** focusing on **${goalsText}**, here is my advice:\n\n` +
          `• **Locality Recommendation**: Being situated in **${locationName}**, you have perfect access to fresh local staples. For a balanced diet, prioritize high-fiber options like *Dal Tadka*, *Chana Masala*, or *Sambar*.\n` +
          `• **Preferences Check**: Your spice preference is set to *${spice}*. Avoid heavy, oily gravies like Butter Chicken, and prefer grilled or steamed preparations like *Paneer Tikka* or *Steamed Idli*.\n\n` +
          `Would you like me to create a specific calorie-counted recipe or suggest food combinations for your health goals?`;
      }

      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: responseText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1200);
  }

  function clearHistory() {
    setMessages([
      {
        id: 1,
        sender: 'bot',
        text: `Chat cleared! Let's start fresh. How can I assist you with your diet goals today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ 
            width: 36, 
            height: 36, 
            borderRadius: '50%', 
            background: 'rgba(255,107,53,0.12)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            overflow: 'hidden',
            border: `1px solid rgba(255,107,53,0.2)`
          }}>
            <img 
              src="/logo.jpg" 
              alt="AI" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
              AI Diet Coach
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>Online · Expert nutrition guidance</div>
          </div>
        </div>
        <button onClick={clearHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: C.muted2 }} title="Clear history">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Main Chat Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', background: '#111318' }}>
        {/* Messages list */}
        <div className="scroll-row" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map(m => {
            const isBot = m.sender === 'bot';
            return (
              <div key={m.id} style={{ display: 'flex', gap: 10, flexDirection: isBot ? 'row' : 'row-reverse', alignItems: 'flex-start' }}>
                {/* Avatar */}
                <div style={{ 
                  width: 28, height: 28, borderRadius: '50%', 
                  background: isBot ? 'rgba(255,107,53,0.12)' : '#20242c',
                  border: `1px solid ${isBot ? 'rgba(255,107,53,0.2)' : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  overflow: 'hidden'
                }}>
                  {isBot ? (
                    <img 
                      src="/logo.jpg" 
                      alt="AI" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <User size={13} color="#ccc" />
                  )}
                </div>

                {/* Bubble */}
                <div style={{ 
                  maxWidth: '75%', 
                  background: isBot ? '#171a20' : C.orange,
                  border: `1px solid ${isBot ? C.border : C.orange}`,
                  borderRadius: isBot ? '0px 14px 14px 14px' : '14px 0px 14px 14px',
                  padding: '10px 14px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                  <div style={{ 
                    fontSize: 13, 
                    lineHeight: 1.5, 
                    color: '#fff', 
                    whiteSpace: 'pre-line' 
                  }}>
                    {m.text}
                  </div>
                  <div style={{ fontSize: 9, color: isBot ? C.muted2 : 'rgba(255,255,255,0.7)', textAlign: 'right', marginTop: 4 }}>
                    {m.time}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ 
                width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,107,53,0.12)',
                border: '1px solid rgba(255,107,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <img 
                  src="/logo.jpg" 
                  alt="AI" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              </div>
              <div style={{ background: '#171a20', border: `1px solid ${C.border}`, borderRadius: '0px 14px 14px 14px', padding: '12px 16px', display: 'flex', gap: 4 }}>
                <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, animation: 'blink 1.2s infinite 0.1s' }} />
                <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, animation: 'blink 1.2s infinite 0.2s' }} />
                <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, animation: 'blink 1.2s infinite 0.3s' }} />
                <style>{`
                  @keyframes blink {
                    0% { opacity: 0.3; transform: translateY(0px); }
                    50% { opacity: 1; transform: translateY(-3px); }
                    100% { opacity: 0.3; transform: translateY(0px); }
                  }
                `}</style>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestion Prompts */}
        {messages.length === 1 && (
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted2, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={11} color={C.orange} />
              Common Questions
            </div>
            <div className="scroll-row" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {QUICK_PROMPTS.map(p => (
                <button 
                  key={p} 
                  onClick={() => handleSend(p)}
                  style={{
                    padding: '8px 14px', borderRadius: 10, background: '#171a20', border: `1px solid ${C.border}`,
                    color: '#ccc', fontSize: 12, fontWeight: 600, flexShrink: 0, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.orange}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Input Box */}
        <div style={{ padding: '10px 16px 15px', borderTop: `1px solid ${C.border}`, background: '#111318' }}>
          <div style={{ display: 'flex', gap: 10, background: '#171a20', border: `1px solid ${C.border}`, borderRadius: 12, padding: '8px 10px 8px 14px', alignItems: 'center' }}>
            <input 
              placeholder="Ask anything (e.g. oats recipe, healthy snack)..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: 14, outline: 'none' }}
            />
            <button 
              onClick={() => handleSend()}
              disabled={!query.trim()}
              style={{ 
                background: query.trim() ? C.orange : 'rgba(255,255,255,0.03)', 
                border: 'none', borderRadius: 10, width: 34, height: 34, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                cursor: query.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' 
              }}
            >
              <Send size={15} color={query.trim() ? '#fff' : '#444'} />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
