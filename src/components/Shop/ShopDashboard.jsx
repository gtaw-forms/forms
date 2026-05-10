import React, { useState, useMemo } from 'react';
import styles from './ShopDashboard.module.css';
import SidebarNav from '../UI/SidebarNav';
import { useNotification } from '../../contexts/NotificationContext';
import phmcLogo from '../../assets/phmc.png';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';

const SHOP_ITEMS = [
  { id: 1, name: "Evelyn Fund", category: "PHMC", price: "$1,000,000", description: "You give the hospital director money for no real reason." },
  { id: 2, name: "Advanced Med-kit", category: "PHMC", price: "$150", description: "Advanced medical supply bag for paramedics." },
  { id: 3, name: "Surgeon Coat", category: "PHMC", price: "$200", description: "Professional attire for surgical procedures." },
  { id: 4, name: "Fire Extinguisher", category: "LSFD", price: "$75", description: "Essential fire safety equipment." },
  { id: 5, name: "Firefighter Helmet", category: "LSFD", price: "$120", description: "Heavy-duty protection for fire rescue." },
  { id: 6, name: "Death Insurance", category: "LSFD", price: "$500", description: "Complete your life insurance coverage with the Forensic Science and Pathology Life 2.0 Plan!." },
  { id: 7, name: "Faster Death Processing", category: "Donations", price: "$10", description: "You die faster and are collected by the Coroners!." },
  { id: 8, name: "Priority Queue", category: "Donations", price: "$25", description: "Skip the line for administrative processing." },
  { id: 9, name: "Custom Title", category: "Donations", price: "$50", description: "A unique title on your employee profile." }
];

const ShopDashboard = () => {
  const { user } = useGtaWorldAuth();
  const [selectedCategory, setSelectedCategory] = useState("PHMC");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('phmc_shop_cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (e) {
      console.error("Error loading cart from localStorage:", e);
      return [];
    }
  });
  const [orders, setOrders] = useState(() => {
    try {
      const savedOrders = localStorage.getItem('phmc_shop_orders');
      return savedOrders ? JSON.parse(savedOrders) : [];
    } catch (e) {
      console.error("Error loading orders from localStorage:", e);
      return [];
    }
  });
  const [showOrders, setShowOrders] = useState(false);
  const [cartCollapsed, setCartCollapsed] = useState(false);
  const { showNotification } = useNotification();

  // Save cart and orders to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('phmc_shop_cart', JSON.stringify(cart));
  }, [cart]);

  React.useEffect(() => {
    localStorage.setItem('phmc_shop_orders', JSON.stringify(orders));
  }, [orders]);

  const categories = [
    { name: "PHMC", icon: "fa-hospital" },
    { name: "LSFD", icon: "fa-fire-extinguisher" },
    { name: "Donations", icon: "fa-hand-holding-heart" }
  ];

  const filteredItems = useMemo(() => {
    return SHOP_ITEMS.filter(item => {
      const matchesCategory = item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchTerm]);

  const handleAddToCart = (item) => {
    setCart(prev => {
      const existingItem = prev.find(i => i.id === item.id);
      if (existingItem) {
        return prev.map(i => 
          i.id === item.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1, cartId: `${item.id}-${Date.now()}` }];
    });
    showNotification(`${item.name} added to cart!`, 'success');
  };

  const handleRemoveFromCart = (cartId) => {
    setCart(prev => {
      const item = prev.find(i => i.cartId === cartId);
      if (item && item.quantity > 1) {
        return prev.map(i => 
          i.cartId === cartId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter(i => i.cartId !== cartId);
    });
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    
    const newOrder = {
      orderId: `ORD-${Date.now().toString().slice(-6)}`,
      items: [...cart],
      total: cartTotal,
      status: 'Processing',
      timestamp: new Date().toISOString(),
      userName: user?.username || user?.faction?.characterName || 'Guest User'
    };

    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    showNotification(`Order ${newOrder.orderId} placed successfully!`, 'success');
    setShowOrders(true);
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const priceString = String(item.price || "0").replace(/[^0-9]/g, '');
      const price = parseInt(priceString, 10) || 0;
      return sum + (price * (item.quantity || 1));
    }, 0);
  }, [cart]);

  return (
    <div className={styles.shopContainer}>
      <SidebarNav />

      <div className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          <h1>PHMC Official Shop</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className={styles.ordersToggleButton} 
              onClick={() => setShowOrders(!showOrders)}
              title="Track My Orders"
            >
              <i className="fas fa-truck"></i>
              {orders.length > 0 && <span className={styles.orderCountBadge}>{orders.length}</span>}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.contentWrapper}>
          
          {/* Left Sidebar - Categories */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <h3 className={styles.sidebarTitle}>Categories</h3>
              <ul className={styles.categoryList}>
                {categories.map(cat => (
                  <li 
                    key={cat.name} 
                    className={`${styles.categoryItem} ${selectedCategory === cat.name ? styles.active : ''}`}
                    onClick={() => setSelectedCategory(cat.name)}
                  >
                    <i className={`fas ${cat.icon}`}></i>
                    <span>{cat.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.sidebarSection}>
              <h3 className={styles.sidebarTitle}>Search</h3>
              <input 
                type="text" 
                placeholder="Find products..." 
                className={styles.sidebarSearch}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </aside>

          {/* Main Content - Items Grid */}
          <div className={styles.mainContent}>
            <div className={styles.itemsGrid}>
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <div key={item.id} className={styles.itemCard}>
                    <div className={styles.imageWrapper}>
                      <img src={phmcLogo} alt={item.name} className={styles.itemImage} />
                      <span className={styles.categoryBadge}>{item.category}</span>
                    </div>
                    <div className={styles.itemInfo}>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div className={styles.itemFooter}>
                        <span className={styles.price}>{item.price}</span>
                        <button 
                          className={styles.buyButton}
                          onClick={() => handleAddToCart(item)}
                        >
                          <i className="fas fa-cart-plus"></i>
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <i className="fas fa-search"></i>
                  <p>No products found.</p>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Cart Panel */}
          <div className={`${styles.persistentCart} ${cartCollapsed ? styles.collapsed : ''}`}>
            <div className={styles.cartHeader} onClick={() => setCartCollapsed(!cartCollapsed)}>
              <h2>
                <i className="fas fa-shopping-basket"></i>
                {!cartCollapsed && "My Basket"}
                {cartCollapsed && cart.length > 0 && (
                  <span className={styles.cartBadge}>{cart.length}</span>
                )}
              </h2>
              <button className={styles.collapseToggle} onClick={(e) => { e.stopPropagation(); setCartCollapsed(!cartCollapsed); }}>
                <i className={`fas fa-chevron-${cartCollapsed ? 'up' : 'down'}`}></i>
              </button>
            </div>
            
            {!cartCollapsed && (
              <>
                <div className={styles.cartItems}>
                  {cart.length === 0 ? (
                    <div className={styles.emptyCart}>
                      <p>Your basket is empty</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.cartId} className={styles.cartItem}>
                        <div className={styles.cartItemInfo}>
                          <h4>{item.name} {item.quantity > 1 ? `- x${item.quantity}` : ''}</h4>
                          <span>{item.price} {item.quantity > 1 ? `(ea)` : ''}</span>
                        </div>
                        <button onClick={() => handleRemoveFromCart(item.cartId)} className={styles.removeItem}>
                          <i className="fas fa-minus-circle"></i>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className={styles.cartFooter}>
                  <div className={styles.totalRow}>
                    <span>Total:</span>
                    <span className={styles.totalPrice}>${cartTotal.toLocaleString()}</span>
                  </div>
                  <button 
                    className={styles.checkoutButton}
                    onClick={handlePlaceOrder}
                    disabled={cart.length === 0}
                  >
                    Place Order
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Orders Sidebar/Overlay */}
      <div className={`${styles.cartOverlay} ${showOrders ? styles.show : ''}`} onClick={() => setShowOrders(false)}>
        <div className={styles.cartPanel} onClick={e => e.stopPropagation()}>
          <div className={styles.cartHeader}>
            <h2>Order Tracking</h2>
            <button onClick={() => setShowOrders(false)} className={styles.closeCart}>×</button>
          </div>
          
          <div className={styles.cartItems}>
            {orders.length === 0 ? (
              <div className={styles.emptyCart}>
                <i className="fas fa-truck"></i>
                <p>No active orders</p>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.orderId} className={styles.orderCard}>
                  <div className={styles.orderCardHeader}>
                    <span className={styles.orderId}>{order.orderId}</span>
                    <span className={`${styles.statusBadge} ${styles[order.status.toLowerCase()]}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className={styles.orderCardBody}>
                    <div className={styles.orderItemsList}>
                      {order.items.slice(0, 2).map(item => item.name).join(', ')}
                      {order.items.length > 2 && ` +${order.items.length - 2} more`}
                    </div>
                    <div className={styles.orderMeta}>
                      <span>{new Date(order.timestamp).toLocaleDateString()}</span>
                      <span className={styles.orderTotal}>${order.total.toLocaleString()}</span>
                    </div>
                    <div className={styles.orderUser}>Ordered by: {order.userName}</div>
                  </div>
                  <button 
                    className={styles.trackButton}
                    onClick={() => showNotification(`Tracking details for ${order.orderId} will be sent to your Discord.`, 'info')}
                  >
                    View Full Details
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopDashboard;
