import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, ChevronDown, Heart, Menu, Moon, Plus, Search, ShoppingBag, Sparkles, Sun, Trash2 } from 'lucide-react'
import './App.css'

const fallbackProducts = [
  { id: 1, name: 'Cloud Milk Cleanser', category: 'Cleansers', price: 28, rating: 4.9, reviews: 128, size: '150 ml', image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=85', description: 'A cushiony, low-foam cleanser that melts away the day without leaving skin tight.' },
  { id: 2, name: 'Dew Drop Serum', category: 'Serums', price: 42, rating: 4.8, reviews: 96, size: '30 ml', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=85', description: 'A glass-skin serum with niacinamide, hyaluronic acid, and a soft botanical glow.' },
  { id: 3, name: 'Petal Veil Moisturizer', category: 'Moisturizers', price: 36, rating: 4.7, reviews: 84, size: '50 ml', image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=900&q=85', description: 'A featherlight daily veil that calms, cushions, and keeps moisture close.' },
  { id: 4, name: 'Sun Cloud SPF 50', category: 'Sun Care', price: 31, rating: 4.9, reviews: 211, size: '50 ml', image: 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=900&q=85', description: 'Invisible mineral protection with a dewy finish and no chalky cast.' },
  { id: 5, name: 'Night Bloom Oil', category: 'Treatments', price: 48, rating: 4.8, reviews: 63, size: '30 ml', image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85', description: 'A restorative facial oil made for slow evenings and soft, rested skin.' },
  { id: 6, name: 'Sea Glass Eye Cream', category: 'Treatments', price: 34, rating: 4.6, reviews: 52, size: '15 ml', image: 'https://images.unsplash.com/photo-1570194065650-d99fb4b38b18?auto=format&fit=crop&w=900&q=85', description: 'A cooling eye cream that brightens the look of tired mornings.' },
  { id: 7, name: 'Rosewater Mist', category: 'Toners', price: 22, rating: 4.7, reviews: 76, size: '100 ml', image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=900&q=85', description: 'A fine, refreshing mist that gives skin an instant sip of hydration.' },
  { id: 8, name: 'Soft Reset Mask', category: 'Masks', price: 29, rating: 4.8, reviews: 41, size: '75 ml', image: 'https://images.unsplash.com/photo-1570554886111-e80fcca6a1d0?auto=format&fit=crop&w=900&q=85', description: 'A creamy overnight mask for the nights when your skin needs a reset.' },
  { id: 9, name: 'Citrus Enzyme Polish', category: 'Exfoliators', price: 27, rating: 4.7, reviews: 58, size: '60 ml', image: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=900&q=85', description: 'A gentle fruit enzyme polish that leaves skin smooth, bright, and comfortable.' },
  { id: 10, name: 'Barrier Balm', category: 'Treatments', price: 39, rating: 4.9, reviews: 88, size: '45 ml', image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=900&q=85', description: 'A rich, comforting balm for dry patches, stressed skin, and overnight repair.' },
  { id: 11, name: 'Cloud Body Lotion', category: 'Body Care', price: 26, rating: 4.8, reviews: 74, size: '250 ml', image: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=900&q=85', description: 'A silky everyday lotion with oat, shea, and a soft skin-scented finish.' },
  { id: 12, name: 'Under-Eye Rescue Patches', category: 'Treatments', price: 24, rating: 4.6, reviews: 49, size: '30 pairs', image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=85', description: 'Cooling hydrogel patches for a refreshed, rested look in ten quiet minutes.' },
  { id: 13, name: 'Lip Dew Treatment', category: 'Lip Care', price: 18, rating: 4.8, reviews: 112, size: '12 ml', image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=900&q=85', description: 'A glossy treatment oil that softens lips with a sheer veil of hydration.' },
  { id: 14, name: 'Green Tea Gel Cleanser', category: 'Cleansers', price: 25, rating: 4.7, reviews: 67, size: '120 ml', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=85', description: 'A fresh gel cleanser that lifts excess oil while keeping skin balanced.' },
  { id: 15, name: 'Cloudberry Brightening Drops', category: 'Serums', price: 45, rating: 4.9, reviews: 103, size: '30 ml', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=85', description: 'A vitamin-rich brightening concentrate for a clearer, more even-looking glow.' },
  { id: 16, name: 'Mineral Bath Soak', category: 'Body Care', price: 30, rating: 4.8, reviews: 39, size: '400 g', image: 'https://images.unsplash.com/photo-1607006344380-b6775a0824aa?auto=format&fit=crop&w=900&q=85', description: 'Mineral-rich salts for a restorative soak at the end of a long day.' },
  { id: 17, name: 'Melt Away Cleansing Balm', category: 'Cleansers', price: 33, rating: 4.9, reviews: 91, size: '90 ml', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=85', description: 'A buttery first cleanse that dissolves makeup, sunscreen, and the pace of the day.' },
  { id: 18, name: 'Lunar Peptide Cream', category: 'Moisturizers', price: 44, rating: 4.8, reviews: 72, size: '50 ml', image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=900&q=85', description: 'A plush peptide cream that supports a smoother, bouncier-looking complexion.' },
  { id: 19, name: 'Blue Hour Calming Gel', category: 'Treatments', price: 32, rating: 4.7, reviews: 55, size: '50 ml', image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85', description: 'A cooling gel treatment for flushed, reactive, or overheated skin.' },
  { id: 20, name: 'Daily Glow Essence', category: 'Toners', price: 28, rating: 4.8, reviews: 64, size: '120 ml', image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=900&q=85', description: 'A silky essence that layers hydration into the first step of your routine.' },
  { id: 21, name: 'Apricot Cloud Scrub', category: 'Exfoliators', price: 25, rating: 4.6, reviews: 47, size: '70 ml', image: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=900&q=85', description: 'A soft cream scrub with rounded powders for a polished, never stripped finish.' },
  { id: 22, name: 'After Sun Milk', category: 'Sun Care', price: 29, rating: 4.8, reviews: 86, size: '150 ml', image: 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=900&q=85', description: 'A cooling after-sun milk that replenishes comfort after bright days outside.' },
  { id: 23, name: 'Vanilla Mint Lip Mask', category: 'Lip Care', price: 21, rating: 4.9, reviews: 93, size: '15 ml', image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=900&q=85', description: 'An overnight lip mask that wakes up soft, cushiony, and quietly glossy.' },
  { id: 24, name: 'Cloud Soft Hand Cream', category: 'Body Care', price: 19, rating: 4.7, reviews: 61, size: '75 ml', image: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=900&q=85', description: 'A fast-absorbing hand cream for soft palms without a slippery finish.' },
]
const categories = ['All products', 'Cleansers', 'Serums', 'Moisturizers', 'Sun Care', 'Treatments', 'Toners', 'Masks', 'Exfoliators', 'Body Care', 'Lip Care']
const ShopContext = createContext(null)
const API_URL = 'http://localhost:3001/api'

function ShopProvider({ children }) {
  const [products, setProducts] = useState(fallbackProducts)
  const [cart, setCart] = useState([])
  const [wishlist, setWishlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('luma-theme') === 'dark')
  const sessionId = localStorage.getItem('session-id') || crypto.randomUUID()

  useEffect(() => {
    localStorage.setItem('session-id', sessionId)
    Promise.all([
      fetch(`${API_URL}/products`).then(async (response) => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json() }),
      fetch(`${API_URL}/cart/${sessionId}`).then(async (response) => { if (!response.ok) throw new Error('Cart unavailable'); return response.json() }),
      fetch(`${API_URL}/wishlist/${sessionId}`).then(async (response) => { if (!response.ok) throw new Error('Wishlist unavailable'); return response.json() }),
    ]).then(([productData, cartData, wishlistData]) => {
      setProducts(productData.products || [])
      const productMap = new Map((productData.products || []).map((product) => [product.id, product]))
      setCart((cartData.items || []).map((item) => ({ ...productMap.get(item.productId), quantity: item.quantity })).filter((item) => item.id))
      setWishlist(wishlistData.productIds || [])
    }).catch((error) => {
      setApiError(`${error.message}. Start the API and check your connection.`)
    }).finally(() => setLoading(false))
  }, [sessionId])

  useEffect(() => { localStorage.setItem('luma-theme', darkMode ? 'dark' : 'light'); document.documentElement.dataset.theme = darkMode ? 'dark' : 'light' }, [darkMode])
  const syncCart = useCallback((items) => fetch(`${API_URL}/cart/${sessionId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.map((item) => ({ productId: item.id, quantity: item.quantity })) }) }).then(async (response) => { if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Cart could not be saved') } return response.json() }).catch((error) => setApiError(error.message)), [sessionId])
  const addToCart = (product) => setCart((items) => { const existing = items.find((item) => item.id === product.id); const next = existing ? items.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...items, { ...product, quantity: 1 }]; syncCart(next); return next })
  const updateQuantity = (id, amount) => setCart((items) => { const next = items.map((item) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + amount) } : item).filter((item) => item.quantity > 0); syncCart(next); return next })
  const removeFromCart = (id) => setCart((items) => { const next = items.filter((item) => item.id !== id); syncCart(next); return next })
  const clearCart = useCallback(() => { setCart([]); syncCart([]) }, [syncCart])
  const toggleWishlist = (id) => { setWishlist((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]); fetch(`${API_URL}/wishlist/${sessionId}/${id}`, { method: 'POST' }).then(async (response) => { if (!response.ok) throw new Error('Wishlist could not be saved') }).catch((error) => setApiError(error.message)) }
  return <ShopContext.Provider value={{ products, loading, apiError, setApiError, cart, wishlist, darkMode, setDarkMode, addToCart, updateQuantity, removeFromCart, clearCart, toggleWishlist }}>{children}</ShopContext.Provider>
}
function useShop() { return useContext(ShopContext) }

function Header() {
  const { cart, wishlist, darkMode, setDarkMode } = useShop(); const [menuOpen, setMenuOpen] = useState(false)
  return <header className="site-header"><Link to="/" className="brand"><span className="brand-mark">L</span><span>luma<span className="brand-dot">.</span></span></Link><nav className={menuOpen ? 'nav-links open' : 'nav-links'}><Link to="/">Home</Link><Link to="/shop">Shop</Link><Link to="/about">About</Link><Link to="/journal">Journal</Link><Link to="/contact">Contact</Link></nav><div className="header-actions"><button className="icon-button" aria-label="Toggle theme" onClick={() => setDarkMode(!darkMode)}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><Link className="icon-button with-count" to="/wishlist" aria-label="Wishlist"><Heart size={19} fill={wishlist.length ? 'currentColor' : 'none'} /><span>{wishlist.length}</span></Link><Link className="bag-button" to="/cart"><ShoppingBag size={17} /><span>Bag</span><b>{cart.reduce((sum, item) => sum + item.quantity, 0)}</b></Link><button className="menu-button" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button></div></header>
}

function ApiNotice() { const { apiError, setApiError } = useShop(); return apiError ? <div className="api-notice" role="alert"><span>{apiError}</span><button onClick={() => setApiError('')} aria-label="Dismiss notification">×</button></div> : null }

function ProductCard({ product }) {
  const { wishlist, toggleWishlist, addToCart } = useShop(); const wished = wishlist.includes(product.id)
  return <article className="product-card"><div className="product-image-wrap"><Link to={`/product/${product.id}`}><img src={product.image} alt={product.name} /></Link><button className={wished ? 'wishlist active' : 'wishlist'} onClick={() => toggleWishlist(product.id)} aria-label="Add to wishlist"><Heart size={18} fill={wished ? 'currentColor' : 'none'} /></button><span className="product-tag">{product.category}</span></div><div className="product-info"><div><Link to={`/product/${product.id}`} className="product-name">{product.name}</Link><p className="product-size">{product.size}</p></div><button className="add-mini" onClick={() => addToCart(product)} aria-label={`Add ${product.name} to bag`}><Plus size={18} /></button></div><div className="product-meta"><span>${product.price}</span><span className="rating">★ {product.rating} <em>({product.reviews})</em></span></div></article>
}

function ShopPage() {
  const { products, loading } = useShop()
  const [params, setParams] = useSearchParams(); const [query, setQuery] = useState(params.get('q') || ''); const [sort, setSort] = useState('featured'); const category = params.get('category') || 'All products'; const maxPrice = Number(params.get('max') || 60)
  const filtered = products.filter((product) => (category === 'All products' || product.category === category) && product.price <= maxPrice && product.name.toLowerCase().includes(query.toLowerCase())).sort((first, second) => sort === 'price-low' ? first.price - second.price : sort === 'price-high' ? second.price - first.price : sort === 'rating' ? second.rating - first.rating : sort === 'name' ? first.name.localeCompare(second.name) : first.id - second.id)
  const updateFilter = (key, value) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next) }
  return <main><section className="shop-heading"><div><p className="eyebrow">The collection</p><h1>Good skin, <i>gently.</i></h1><p className="heading-copy">Thoughtful essentials for your everyday ritual. Made with less, chosen with care.</p></div><div className="search-box"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); updateFilter('q', event.target.value) }} placeholder="Search the collection" /></div></section>{loading ? <div className="empty-state"><Sparkles size={28} /><h2>Loading the collection.</h2></div> : <section className="shop-layout"><aside className="filters"><p className="filter-label">Browse by</p>{categories.map((item) => <button key={item} className={category === item ? 'filter-option active' : 'filter-option'} onClick={() => updateFilter('category', item === 'All products' ? '' : item)}>{item}<span>{item === 'All products' ? products.length : products.filter((product) => product.category === item).length}</span></button>)}<div className="price-filter"><p className="filter-label">Price up to <strong>${maxPrice}</strong></p><input type="range" min="20" max="60" value={maxPrice} onChange={(event) => updateFilter('max', event.target.value)} /></div></aside><div className="catalog"><div className="catalog-toolbar"><span>{filtered.length} products</span><label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="rating">Top rated</option><option value="name">Name</option></select><ChevronDown size={15} /></label></div>{filtered.length ? <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><Sparkles size={28} /><h2>No matches just yet.</h2><p>Try a different search or reset your filters.</p><button className="text-button" onClick={() => { setQuery(''); setParams({}) }}>Clear filters <ArrowRight size={15} /></button></div>}</div></section>}</main>
}

function HomePage() { const { products, loading } = useShop(); return <main><section className="hero"><div className="hero-copy"><p className="eyebrow">Skincare, simplified</p><h1>Your skin's <i>quiet</i> luxury.</h1><p>Small rituals. Considered ingredients. A softer way to take care of the skin you live in.</p><Link to="/shop" className="primary-button">Shop the collection <ArrowRight size={16} /></Link><div className="hero-note"><span>✦</span> Dermatologist tested<br /><span>✦</span> Kind to sensitive skin</div></div><div className="hero-visual"><img src="https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=1200&q=90" alt="Luma skincare bottles on a stone surface" /><div className="hero-stamp">made for<br /><i>slow</i> mornings</div></div></section><section className="ticker"><span>Clean formulas</span><b>✦</b><span>Thoughtful rituals</span><b>✦</b><span>Visible calm</span><b>✦</b><span>Clean formulas</span></section><section className="featured" id="ritual"><div className="section-intro"><div><p className="eyebrow">Meet your essentials</p><h2>A little <i>luma</i> goes a long way.</h2></div><Link to="/shop" className="text-button">View all products <ArrowRight size={15} /></Link></div>{loading ? <div className="empty-state"><Sparkles size={28} /><h2>Loading the collection.</h2></div> : <div className="product-grid">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div>}</section><section className="ritual-band" id="journal"><div><p className="eyebrow">The luma ritual</p><h2>Less noise.<br /><i>More glow.</i></h2></div><p>We believe skincare should feel like a breath, not a chore. Each formula is made to be understood, enjoyed, and used right down to the last drop.</p><Link to="/shop" className="circle-arrow"><ArrowRight size={20} /></Link></section></main> }

function ProductPage() { const { id } = useParams(); const { products, loading, addToCart, wishlist, toggleWishlist, setApiError } = useShop(); const product = products.find((item) => item.id === Number(id)); const [added, setAdded] = useState(false); const [reviews, setReviews] = useState([]); const [review, setReview] = useState({ name: '', rating: 5, text: '' }); const [reviewLoading, setReviewLoading] = useState(false); useEffect(() => { if (product) fetch(`${API_URL}/products/${product.id}/reviews`).then((response) => response.json()).then((data) => setReviews(data.reviews || [])).catch(() => setApiError('Reviews could not be loaded.')) }, [product, setApiError]); if (loading) return <div className="empty-state page-empty"><h2>Loading product.</h2></div>; if (!product) return <div className="empty-state page-empty"><h2>Product not found</h2><Link to="/shop" className="text-button">Back to shop <ArrowRight size={15} /></Link></div>; const wished = wishlist.includes(product.id); const submitReview = async (event) => { event.preventDefault(); setReviewLoading(true); try { const response = await fetch(`${API_URL}/products/${product.id}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Review could not be submitted'); setReviews((items) => [data, ...items]); setReview({ name: '', rating: 5, text: '' }) } catch (error) { setApiError(error.message) } finally { setReviewLoading(false) } }; return <main className="detail-page"><Link to="/shop" className="back-link">← Back to collection</Link><div className="detail-layout"><div className="detail-image"><img src={product.image} alt={product.name} /></div><div className="detail-copy"><p className="eyebrow">{product.category}</p><h1>{product.name}</h1><div className="detail-rating">★ {product.rating} <span>{product.reviews} reviews</span></div><p className="detail-description">{product.description}</p><div className="detail-price">${product.price}<span>{product.size} · {product.inventory} in stock</span></div><div className="detail-actions"><button className="primary-button" disabled={!product.inventory} onClick={() => { addToCart(product); setAdded(true) }}>{product.inventory ? (added ? 'Added to bag' : 'Add to bag') : 'Out of stock'} <ShoppingBag size={16} /></button><button className={wished ? 'outline-button active' : 'outline-button'} onClick={() => toggleWishlist(product.id)}><Heart size={17} fill={wished ? 'currentColor' : 'none'} /> {wished ? 'Saved' : 'Save'}</button></div><div className="detail-note"><span>✦</span><p>Free shipping on orders over $50<br /><span>Easy returns within 30 days</span></p></div></div></div><section className="reviews-section"><div><p className="eyebrow">Community notes</p><h2>Reviews from <i>real rituals.</i></h2></div><div className="reviews-list">{reviews.length ? reviews.map((item) => <article className="review" key={`${item.createdAt}-${item.name}`}><strong>{'★'.repeat(item.rating)}</strong><p>{item.text}</p><span>{item.name}</span></article>) : <p className="muted-copy">Be the first to share a note about this formula.</p>}</div><form className="review-form" onSubmit={submitReview}><p className="filter-label">Leave a review</p><input placeholder="Your name" value={review.name} onChange={(event) => setReview({ ...review, name: event.target.value })} required /><select value={review.rating} onChange={(event) => setReview({ ...review, rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}</select><textarea placeholder="Your experience" value={review.text} onChange={(event) => setReview({ ...review, text: event.target.value })} required /><button className="primary-button" disabled={reviewLoading}>{reviewLoading ? 'Sending...' : 'Share review'}</button></form></section></main> }

function CartPage() { const { cart, updateQuantity, removeFromCart } = useShop(); const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0); return <main className="cart-page"><div className="cart-heading"><div><p className="eyebrow">Your ritual</p><h1>Your bag <i>({cart.length})</i></h1></div><Link to="/shop" className="text-button">Continue shopping <ArrowRight size={15} /></Link></div>{cart.length ? <div className="cart-layout"><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.id}><img src={item.image} alt={item.name} /><div className="cart-item-info"><Link to={`/product/${item.id}`}>{item.name}</Link><span>{item.size} · ${item.price}</span><div className="quantity"><button onClick={() => updateQuantity(item.id, -1)}>-</button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.id, 1)}>+</button></div></div><button className="remove-button" onClick={() => removeFromCart(item.id)} aria-label={`Remove ${item.name}`}><Trash2 size={17} /></button></div>)}</div><aside className="summary"><p className="filter-label">Order summary</p><div><span>Subtotal</span><b>${subtotal.toFixed(2)}</b></div><div><span>Shipping</span><span>{subtotal >= 50 ? 'Free' : '$5.00'}</span></div><hr /><div className="summary-total"><span>Total</span><b>${(subtotal + (subtotal >= 50 ? 0 : 5)).toFixed(2)}</b></div><Link to="/checkout" className="primary-button checkout-button">Checkout <ArrowRight size={16} /></Link><p className="secure-note">Taxes calculated at checkout</p></aside></div> : <div className="empty-state cart-empty"><ShoppingBag size={30} /><h2>Your bag is taking a breath.</h2><p>Add something lovely to begin.</p><Link to="/shop" className="primary-button">Explore products <ArrowRight size={15} /></Link></div>}</main> }

function WishlistPage() { const { products, wishlist, loading } = useShop(); const saved = products.filter((product) => wishlist.includes(product.id)); return <main className="wishlist-page"><div className="cart-heading"><div><p className="eyebrow">Your saved edit</p><h1>Wishlist <i>({saved.length})</i></h1></div></div>{loading ? <div className="empty-state cart-empty"><h2>Loading your wishlist.</h2></div> : saved.length ? <div className="product-grid">{saved.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state cart-empty"><Heart size={30} /><h2>Nothing saved yet.</h2><p>Keep the formulas that make you curious close by.</p><Link to="/shop" className="primary-button">Find your favorites <ArrowRight size={15} /></Link></div>}</main> }

function AboutPage() { return <main className="editorial-page"><section className="editorial-hero"><div><p className="eyebrow">A softer kind of skincare</p><h1>Good skin is a <i>daily feeling.</i></h1><p>We started Luma with one simple belief: skincare should bring you back to yourself, not add more noise to your day.</p></div><img src="https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=85" alt="Luma skincare products beside a towel" /></section><section className="editorial-split"><div><p className="eyebrow">Our point of view</p><h2>Small formulas.<br /><i>Real rituals.</i></h2></div><div><p>Every Luma formula is made with a short, purposeful ingredient list and a clear role in your routine. No overcomplicated steps. No pressure to chase perfect skin.</p><p>Just thoughtful care for the skin you have today, made in small batches and tested on sensitive skin.</p><Link to="/shop" className="text-button">Meet the collection <ArrowRight size={15} /></Link></div></section><section className="values-grid"><div><strong>01</strong><h3>Considered</h3><p>Ingredients chosen for comfort, function, and everyday use.</p></div><div><strong>02</strong><h3>Gentle</h3><p>Formulas that support your barrier instead of fighting it.</p></div><div><strong>03</strong><h3>Honest</h3><p>Clear rituals, clear textures, and no impossible promises.</p></div></section></main> }

function JournalPage() { const [entries, setEntries] = useState([]); const { setApiError } = useShop(); useEffect(() => { fetch(`${API_URL}/content/journal`).then((response) => response.json()).then((data) => setEntries(data.entries || [])).catch(() => setApiError('Journal content could not be loaded.')) }, [setApiError]); return <main className="journal-page"><section className="journal-heading"><p className="eyebrow">The Luma journal</p><h1>Notes for a <i>slower</i> routine.</h1><p>Thoughts, rituals, and ingredient wisdom for making skincare feel like yours.</p></section><div className="journal-list">{entries.map((entry, index) => <article className="journal-entry" key={entry.title}><span>0{index + 1}</span><div><p className="eyebrow">{entry.type}</p><h2>{entry.title}</h2><p>{entry.text}</p></div><ArrowRight size={20} /></article>)}</div></main> }

function ContactPage() { const [content, setContent] = useState({ email: '', phone: '', address: '', hours: '' }); const { setApiError } = useShop(); useEffect(() => { fetch(`${API_URL}/content/contact`).then((response) => response.json()).then(setContent).catch(() => setApiError('Contact details could not be loaded.')) }, [setApiError]); return <main className="contact-page"><section><p className="eyebrow">We are here</p><h1>Have a <i>question?</i></h1><p>Our small team reads every note. Reach us {content.hours}.</p></section><div className="contact-grid"><a href={`mailto:${content.email}`}><span>Email us</span><strong>{content.email}</strong><ArrowRight size={18} /></a><a href={`tel:${content.phone}`}><span>Call us</span><strong>{content.phone}</strong><ArrowRight size={18} /></a><div><span>Visit our studio</span><strong>{content.address.split('\n').map((line) => <span key={line}>{line}<br /></span>)}</strong></div></div></main> }

const countries = [
  { code: 'US', name: 'United States', shipping: 5 },
  { code: 'CA', name: 'Canada', shipping: 12 },
  { code: 'GB', name: 'United Kingdom', shipping: 15 },
  { code: 'AU', name: 'Australia', shipping: 25 },
  { code: 'IN', name: 'India', shipping: 18 },
  { code: 'DE', name: 'Germany', shipping: 10 },
  { code: 'FR', name: 'France', shipping: 10 },
  { code: 'JP', name: 'Japan', shipping: 20 },
]

function CheckoutPage() {
  const { cart, clearCart } = useShop()
  const [checkoutParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [country, setCountry] = useState('US')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [loading, setLoading] = useState(false)
  const [success] = useState(checkoutParams.get('paid') === '1')
  const [orderId] = useState(checkoutParams.get('order') || '')
  const [error, setError] = useState(checkoutParams.get('cancelled') === '1' ? 'Payment was cancelled. Your bag is still saved.' : '')

  useEffect(() => { if (checkoutParams.get('paid') === '1') clearCart() }, [checkoutParams, clearCart])

  const selectedCountry = countries.find(c => c.code === country)
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shipping = subtotal >= 50 ? 0 : selectedCountry?.shipping || 5
  const total = subtotal + shipping

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !address || !city || !state || !zip) {
      alert('Please fill in all fields')
      return
    }

    setLoading(true)
    setError('')
    const items = cart.map(item => ({
      productId: item.id,
      quantity: item.quantity
    }))

    try {
      const sessionId = localStorage.getItem('session-id') || Math.random().toString(36).slice(2, 11)
      localStorage.setItem('session-id', sessionId)

      const response = await fetch(`${API_URL}/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          customer: { email, name, country, address, city, state, zip },
          items
        })
      })

      if (!response.ok) throw new Error('Order API returned an error')
      const checkoutSession = await response.json()
      if (!checkoutSession.url) throw new Error(checkoutSession.error || 'Payment session could not be created')
      window.location.assign(checkoutSession.url)
    } catch (error) {
      setError(`Order could not be placed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return <main className="checkout-page"><div className="order-success"><p className="eyebrow">Order received</p><h1>Thank you, {name.split(' ')[0] || 'there'}.</h1><p>Your order has been placed successfully. We will send updates to {email}.</p><strong>Order number: {orderId}</strong><Link to="/shop" className="primary-button">Continue shopping <ArrowRight size={15} /></Link></div></main>
  }

  if (!cart.length) {
    return <main className="checkout-page"><div className="empty-state"><ShoppingBag size={30} /><h2>Your bag is empty</h2><p>Add items before proceeding to checkout.</p><Link to="/shop" className="primary-button">Continue shopping <ArrowRight size={15} /></Link></div></main>
  }

  return <main className="checkout-page"><div className="checkout-heading"><p className="eyebrow">Complete your order</p><h1>Checkout</h1><Link to="/cart" className="text-button">← Back to cart</Link></div><div className="checkout-layout"><form className="checkout-form" onSubmit={handleSubmit}>{error && <p className="checkout-error">{error}</p>}<fieldset><legend>Contact information</legend><input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /><input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required /></fieldset><fieldset><legend>Shipping address</legend><select value={country} onChange={(e) => setCountry(e.target.value)}>{countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select><input type="text" placeholder="Street address" value={address} onChange={(e) => setAddress(e.target.value)} required /><div className="form-row"><input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required /><input type="text" placeholder="State / Province" value={state} onChange={(e) => setState(e.target.value)} required /><input type="text" placeholder="ZIP / Postal code" value={zip} onChange={(e) => setZip(e.target.value)} required /></div></fieldset><button type="submit" className="primary-button" disabled={loading}>{loading ? 'Processing...' : 'Complete order'} <ArrowRight size={16} /></button></form><aside className="checkout-summary"><p className="filter-label">Order summary</p><div className="summary-items">{cart.map(item => <div key={item.id} className="summary-item"><span>{item.name} × {item.quantity}</span><b>${(item.price * item.quantity).toFixed(2)}</b></div>)}</div><hr /><div className="summary-line"><span>Subtotal</span><b>${subtotal.toFixed(2)}</b></div><div className="summary-line"><span>Shipping ({selectedCountry?.name})</span><b>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</b></div><div className="summary-line"><span>Estimated tax</span><b>Calculated at checkout</b></div><hr /><div className="summary-total"><span>Total</span><b>${total.toFixed(2)}</b></div><p className="secure-note">✦ Secure payment processing<br />✦ {subtotal >= 50 ? 'Free shipping' : `Shipping: $${shipping.toFixed(2)}`}</p></aside></div></main>
}

function App() { return <BrowserRouter><ShopProvider><ApiNotice /><Header /><Routes><Route path="/" element={<HomePage />} /><Route path="/shop" element={<ShopPage />} /><Route path="/product/:id" element={<ProductPage />} /><Route path="/cart" element={<CartPage />} /><Route path="/checkout" element={<CheckoutPage />} /><Route path="/wishlist" element={<WishlistPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/journal" element={<JournalPage />} /><Route path="/contact" element={<ContactPage />} /></Routes><footer><span>luma<span className="brand-dot">.</span></span><nav><Link to="/about">About</Link><Link to="/journal">Journal</Link><Link to="/contact">Contact</Link></nav><span>© 2024 Luma skincare</span></footer></ShopProvider></BrowserRouter> }
export default App
