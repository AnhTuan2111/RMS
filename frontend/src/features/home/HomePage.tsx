import {Link} from 'react-router-dom'
import {useEffect, useState} from 'react'
import {getPublicBestSellingDishes, type PublicBestSellingDish} from '@/shared/api/public'

export default function HomePage() {
    const [bestSellingDishes, setBestSellingDishes] = useState<PublicBestSellingDish[]>([])

    useEffect(() => {
        const controller = new AbortController()

        getPublicBestSellingDishes(controller.signal)
            .then(setBestSellingDishes)
            .catch(() => {
                // Im lặng bỏ qua lỗi — nếu API lỗi, section này chỉ đơn giản không hiển thị
            })

        return () => controller.abort()
    }, [])

    return (
        <main className="restaurant-home">
            <header className="restaurant-navbar">
                <div className="restaurant-brand">
                    <div className="restaurant-logo-mark">满</div>

                    <div>
                        <h1>MÃN VỊ LÂU</h1>
                        <p>满味楼 · Ẩm thực Trung Hoa cao cấp</p>
                        <p className="restaurant-slogan">BOUTIQUE CHINESE DINING</p>
                    </div>
                </div>

                <nav className="restaurant-nav">
                    <a href="#home">TRANG CHỦ</a>
                    <a href="#about">VỀ CHÚNG TÔI</a>
                    <a href="#roles">ĐẶC SẢN</a>
                    <a href="#features">TRẢI NGHIỆM</a>
                    <a href="#contact">LIÊN HỆ</a>

                    <Link className="restaurant-login-btn" to="/login">
                        Đăng nhập
                    </Link>
                </nav>
            </header>

            <section id="home" className="restaurant-hero">
                <div className="restaurant-hero-overlay"></div>

                <div className="restaurant-hero-content">
                    <p className="restaurant-subtitle">Ẩm thực Trung Hoa cao cấp</p>

                    <h2>
                        MÃN VỊ LÂU
                        <span>Tinh hoa hương vị Trung Hoa giữa lòng thành phố</span>
                    </h2>

                    <p className="restaurant-description">
                        Từ lẩu Tứ Xuyên cay tê, dimsum Quảng Đông tinh tế đến hải sản
                        thượng hạng — Mãn Vị Lâu mang đến hành trình ẩm thực Trung Hoa
                        đa vùng miền, được chế biến bởi đầu bếp giàu kinh nghiệm với
                        nguyên liệu tuyển chọn mỗi ngày.
                    </p>

                    <div className="restaurant-hero-actions">
                        <Link className="restaurant-primary-btn" to="/login">
                            Đặt bàn ngay
                        </Link>

                        <a className="restaurant-secondary-btn" href="#roles">
                            Khám phá thực đơn
                        </a>
                    </div>
                </div>
            </section>

            <section id="about" className="restaurant-section restaurant-about">
                <div>
                    <p className="restaurant-section-label">Về Mãn Vị Lâu</p>
                    <h2>Nơi tinh hoa ẩm thực Trung Hoa hội tụ</h2>
                </div>

                <p>
                    Mãn Vị Lâu ra đời với mong muốn mang trọn vẹn tinh hoa ẩm thực
                    Trung Hoa — từ lẩu vùng miền, dimsum Quảng Đông đến các món
                    Tứ Xuyên đậm đà — đến từng thực khách. Không gian riêng tư,
                    giới hạn số bàn để đảm bảo trải nghiệm tinh tế, cùng đầu bếp
                    tận tâm chế biến từ nguyên liệu tươi ngon mỗi ngày.
                </p>
            </section>

            <section id="roles" className="restaurant-section">
                <div className="restaurant-section-header">
                    <p className="restaurant-section-label">Đặc sản nổi bật</p>
                    <h2>Thực đơn được yêu thích nhất</h2>
                </div>

                <div className="restaurant-role-grid">
                    <article>
                        <span>01</span>
                        <h3>Lẩu vùng miền</h3>
                        <p>Từ Tứ Xuyên mala cay tê đến hải sản Quảng Đông, phục vụ theo nồi ấm cúng.</p>
                    </article>

                    <article>
                        <span>02</span>
                        <h3>Dimsum</h3>
                        <p>Há cảo, xíu mại, bánh bao hấp nóng hổi theo phong cách điểm tâm Quảng Đông.</p>
                    </article>

                    <article>
                        <span>03</span>
                        <h3>Món Tứ Xuyên</h3>
                        <p>Hương vị cay tê đặc trưng, đậm đà bản sắc ẩm thực Tây Nam Trung Hoa.</p>
                    </article>

                    <article>
                        <span>04</span>
                        <h3>Hải sản cao cấp</h3>
                        <p>Tôm, cua, bào ngư tươi sống chế biến theo phong cách Trung Hoa thượng hạng.</p>
                    </article>
                </div>
            </section>

            {bestSellingDishes.length > 0 && (
                <section id="best-selling" className="restaurant-section restaurant-best-selling">
                    <div className="restaurant-section-header">
                        <p className="restaurant-section-label">Tuần này</p>
                        <h2>Top món bán chạy</h2>
                    </div>

                    <div className="restaurant-best-selling-grid">
                        {bestSellingDishes.map((dish) => (
                            <article key={dish.rank} className="restaurant-best-selling-card">
                                <span className="restaurant-best-selling-rank">#{dish.rank}</span>
                                <img
                                    src={`/image/${dish.imageUrl}`}
                                    alt={dish.dishName}
                                    className="restaurant-best-selling-image"
                                />
                                <h3>{dish.dishName}</h3>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            <section id="features" className="restaurant-feature-section">
                <div className="restaurant-feature-content">
                    <p className="restaurant-section-label">Vì sao chọn chúng tôi</p>

                    <h2>Trải nghiệm ẩm thực trọn vẹn</h2>

                    <div className="restaurant-feature-list">
                        <div>
                            <strong>Nguyên liệu tươi mỗi ngày</strong>
                            <p>Hải sản, rau củ và gia vị được tuyển chọn kỹ lưỡng hằng ngày.</p>
                        </div>

                        <div>
                            <strong>Đầu bếp ẩm thực Trung Hoa</strong>
                            <p>Đội ngũ đầu bếp giàu kinh nghiệm, am hiểu hương vị đa vùng miền Trung Hoa.</p>
                        </div>

                        <div>
                            <strong>Không gian đậm chất Trung Hoa</strong>
                            <p>Thiết kế tinh tế, riêng tư, lý tưởng cho gia đình, bạn bè và đối tác.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="contact" className="restaurant-cta">
                <p className="restaurant-section-label">Đặt bàn ngay</p>
                <h2>Sẵn sàng thưởng thức hương vị Trung Hoa?</h2>
                <p>Đặt bàn ngay hôm nay để trải nghiệm ẩm thực Mãn Vị Lâu.</p>

                <Link className="restaurant-primary-btn" to="/login">
                    Đặt bàn ngay
                </Link>
            </section>

            <footer className="restaurant-footer">
                <p>© 2026 Mãn Vị Lâu. Ẩm thực Trung Hoa cao cấp.</p>
            </footer>
        </main>
    )
}