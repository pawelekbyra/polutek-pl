import SubscribeButton from "@/app/components/SubscribeButton";

export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-white/95 p-12">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-black">Subscribe Button Showcase</h1>
        <p className="text-gray-600 mb-12">10 different variants and states</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* 1. Flat - Not subscribed */}
          <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-900">1. Flat - Not subscribed</h3>
            <div className="flex items-center justify-center bg-white rounded p-8 h-24">
              <SubscribeButton
                colorScheme="flat"
                initialIsSubscribed={false}
                variant="default"
              />
            </div>
          </div>

          {/* 2. Flat - Subscribed */}
          <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-900">2. Flat - Subscribed</h3>
            <div className="flex items-center justify-center bg-white rounded p-8 h-24">
              <SubscribeButton
                colorScheme="flat"
                initialIsSubscribed={true}
                variant="default"
              />
            </div>
          </div>

          {/* 3. Flat Compact - Not subscribed */}
          <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-900">3. Flat Compact - Not subscribed</h3>
            <div className="flex items-center justify-center bg-white rounded p-8 h-24">
              <SubscribeButton
                colorScheme="flat"
                initialIsSubscribed={false}
                variant="compact"
              />
            </div>
          </div>

          {/* 4. Flat Compact - Subscribed */}
          <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-900">4. Flat Compact - Subscribed</h3>
            <div className="flex items-center justify-center bg-white rounded p-8 h-24">
              <SubscribeButton
                colorScheme="flat"
                initialIsSubscribed={true}
                variant="compact"
              />
            </div>
          </div>

          {/* 5. Default (Paper style) - Not subscribed */}
          <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-900">5. Default (Paper) - Not subscribed</h3>
            <div className="flex items-center justify-center bg-white rounded p-8 h-24">
              <SubscribeButton
                colorScheme="default"
                initialIsSubscribed={false}
                variant="default"
              />
            </div>
          </div>

          {/* 6. Default (Paper style) - Subscribed */}
          <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-900">6. Default (Paper) - Subscribed</h3>
            <div className="flex items-center justify-center bg-white rounded p-8 h-24">
              <SubscribeButton
                colorScheme="default"
                initialIsSubscribed={true}
                variant="default"
              />
            </div>
          </div>

          {/* 7. V2 style - Not subscribed */}
          <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-900">7. V2 - Not subscribed</h3>
            <div className="flex items-center justify-center bg-white rounded p-8 h-24">
              <SubscribeButton
                colorScheme="v2"
                initialIsSubscribed={false}
                variant="default"
              />
            </div>
          </div>

          {/* 8. V2 style - Subscribed */}
          <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-900">8. V2 - Subscribed</h3>
            <div className="flex items-center justify-center bg-white rounded p-8 h-24">
              <SubscribeButton
                colorScheme="v2"
                initialIsSubscribed={true}
                variant="default"
              />
            </div>
          </div>

          {/* 9. Flat on dark background */}
          <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-slate-100">9. Flat on Dark - Not subscribed</h3>
            <div className="flex items-center justify-center bg-slate-950 rounded p-8 h-24">
              <SubscribeButton
                colorScheme="flat"
                initialIsSubscribed={false}
                variant="default"
              />
            </div>
          </div>

          {/* 10. Flat on dark - Subscribed */}
          <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-slate-100">10. Flat on Dark - Subscribed</h3>
            <div className="flex items-center justify-center bg-slate-950 rounded p-8 h-24">
              <SubscribeButton
                colorScheme="flat"
                initialIsSubscribed={true}
                variant="default"
              />
            </div>
          </div>
        </div>

        <div className="mt-16 p-8 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-2xl font-bold mb-4 text-slate-900">Features shown:</h2>
          <ul className="space-y-3 text-slate-700">
            <li>✨ <strong>Glass morphism effect</strong> - backdrop blur, border glow, inset shadows</li>
            <li>🌟 <strong>Gradient background</strong> - depth via subtle gradients</li>
            <li>💫 <strong>Hover glow</strong> - shadow expands, border brightens on hover</li>
            <li>🎯 <strong>Smooth animations</strong> - Framer Motion for y-axis translate and scale</li>
            <li>🎨 <strong>Color schemes</strong> - flat, default (paper), v2</li>
            <li>📱 <strong>Responsive</strong> - compact and default variants</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
