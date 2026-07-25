import {Clock} from "./Clock";

export function WaiterHeader() {
    return (
        <header className="waiter-header">
            <div style={{fontWeight: 700, fontSize: '1.25rem', color: '#1e293b'}}>Sơ đồ bàn nhà hàng</div>
            <Clock/>
        </header>
    );
}
