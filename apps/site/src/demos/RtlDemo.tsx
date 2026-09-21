import { useState, type CSSProperties, type ReactNode } from "react";
import { Bluetooth, Clock, Phone, Star, Sun, Voicemail, Wifi } from "lucide-react";
import {
  BarButton,
  Icon,
  List,
  ListItem,
  NavigationBar,
  ProgressBar,
  SearchField,
  Segment,
  SegmentedControl,
  Slider,
  Switch,
  TabBar,
  TabBarItem,
  TextField,
} from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Right-to-left",
  description:
    "Every component mirrors under dir=\"rtl\": the back button's point, disclosure chevrons, the switch's " +
    "knob travel, the slider and progress fills, segment dividers, badges and text alignment all follow the " +
    "inline direction (the keyboard's QWERTY layout deliberately does not). Layout uses logical CSS properties, " +
    "so nothing changes in LTR. The sidebar's RTL toggle flips the whole showcase; this screen is pinned to RTL " +
    "regardless.",
  usage: `<div className="gs-root" dir="rtl">
  <NavigationBar title="الإعدادات" left={<BarButton variant="back">عام</BarButton>} />
  <List>
    <ListItem title="الواي فاي" detail="تشغيل" accessory="chevron" onClick={() => {}} />
  </List>
</div>`,
  props: [
    { name: "dir", type: '"rtl" | "ltr"', note: "set it on .gs-root (or any ancestor) — components read the inline direction" },
  ],
};

/* small layout helpers only — the components are the demo */
const captionStyle: CSSProperties = {
  margin: "0 10px",
  font: "400 12px/1.3 var(--gs-font)",
  color: "var(--gs-text-secondary)",
  textShadow: "var(--gs-text-emboss)",
  textAlign: "center",
};

/** A full-width cell holding a control; the padding keeps knob shadows and focus rings clear of the cell's clip. */
function ControlRow({ children }: { children: ReactNode }) {
  return <ListItem title={<div style={{ width: "100%", padding: "4px 0" }}>{children}</div>} accessory="none" />;
}

export default function RtlDemo() {
  const [bluetooth, setBluetooth] = useState(true);
  const [autoLock, setAutoLock] = useState(false);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("favorites");
  const [query, setQuery] = useState("");

  return (
    <Screen
      top={
        <NavigationBar
          dir="rtl"
          title="الإعدادات"
          left={<BarButton variant="back">عام</BarButton>}
          right={<BarButton variant="done">تم</BarButton>}
        />
      }
      bottom={
        <TabBar dir="rtl" value={tab} onChange={setTab} label="الهاتف">
          <TabBarItem value="favorites" icon={Star} label="المفضلة" />
          <TabBarItem value="recents" icon={Clock} label="الأخيرة" badge={3} />
          <TabBarItem value="keypad" icon={Phone} label="لوحة المفاتيح" />
          <TabBarItem value="voicemail" icon={Voicemail} label="البريد الصوتي" badge={12} />
        </TabBar>
      }
    >
      {/* direction is inherited through display: contents, so the body mirrors
          no matter what the sidebar toggle says */}
      <div dir="rtl" style={{ display: "contents" }}>
        {/* an English note, so it keeps its own (LTR) bidi order inside the RTL screen */}
        <p dir="ltr" style={captionStyle}>
          This screen is forced to <code>dir="rtl"</code> regardless of the sidebar toggle — the point of the
          back button, the chevrons, the switch, the fills and the badges all swap sides.
        </p>

        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث"
          showCancel={query.length > 0}
          cancelLabel="إلغاء"
          onCancel={() => setQuery("")}
          aria-label="بحث"
        />

        <List header="الاتصال">
          <ListItem
            icon={<Icon icon={Wifi} size={22} />}
            title="الواي فاي"
            detail="تشغيل"
            accessory="chevron"
            onClick={() => {}}
          />
          <ListItem
            icon={<Icon icon={Bluetooth} size={22} />}
            title="البلوتوث"
            accessory={<Switch checked={bluetooth} onChange={setBluetooth} label="البلوتوث" onLabel="تشغيل" offLabel="إيقاف" />}
          />
          <ListItem
            title="القفل التلقائي"
            subtitle="عنوان فرعي طويل جداً يوضح كيف يتم اقتطاع النص من جهة البداية"
            detail="دقيقة واحدة"
            accessory="detail"
            onClick={() => {}}
          />
          <ListItem
            title="الشبكة الخلوية"
            accessory={<Switch checked={autoLock} onChange={setAutoLock} label="الشبكة الخلوية" onLabel="تشغيل" offLabel="إيقاف" />}
          />
          <ListItem title="نغمة الرنين" detail="ماريمبا" accessory="checkmark" />
        </List>

        <List header="الأخيرة">
          <ControlRow>
            <SegmentedControl value={filter} onChange={setFilter} label="تصفية" block>
              <Segment value="all">الكل</Segment>
              <Segment value="missed">الفائتة</Segment>
            </SegmentedControl>
          </ControlRow>
          <ControlRow>
            <Slider defaultValue={70} minIcon={Sun} maxIcon={Sun} label="السطوع" showValue />
          </ControlRow>
          <ControlRow>
            <ProgressBar value={42} showValue label="التنزيل" />
          </ControlRow>
        </List>

        <List header="الحساب">
          <ControlRow>
            <TextField label="الاسم" placeholder="مطلوب" defaultValue="تيمون" />
          </ControlRow>
        </List>
      </div>
    </Screen>
  );
}
