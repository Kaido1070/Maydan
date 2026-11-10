import ExpoModulesCore
import UIKit

public final class MaydanTabBarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MaydanTabBar")

    View(MaydanTabBarView.self) {
      Events("onTabSelect")
      Prop("items") { (view, items: [TabItem]) in view.setItems(items) }
      Prop("selection") { (view, selection: String) in view.setSelection(selection) }
      Prop("colorScheme") { (view, scheme: String) in view.setColorScheme(scheme) }
      Prop("selectionColor") { (view, color: UIColor?) in view.setSelectionColor(color) }
    }
  }
}

struct TabItem: Record, Equatable {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var symbol: String = ""

  static func == (lhs: TabItem, rhs: TabItem) -> Bool {
    lhs.id == rhs.id && lhs.title == rhs.title && lhs.symbol == rhs.symbol
  }
}

final class MaydanTabBarView: ExpoView, UITabBarControllerDelegate {
  let onTabSelect = EventDispatcher()
  private let tabs = UITabBarController()
  private var items: [TabItem] = []
  private var selection = ""

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    tabs.delegate = self
    tabs.view.backgroundColor = .clear
    tabs.view.semanticContentAttribute = .forceRightToLeft
    tabs.tabBar.semanticContentAttribute = .forceRightToLeft
    tabs.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    #if compiler(>=6.2)
    if #available(iOS 26.0, *) {
      tabs.tabBarMinimizeBehavior = .never
    }
    #endif
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil, tabs.parent != nil {
      tabs.willMove(toParent: nil)
      tabs.view.removeFromSuperview()
      tabs.removeFromParent()
    } else {
      attachTabs()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    attachTabs()
    tabs.view.frame = bounds
  }

  private func attachTabs() {
    guard window != nil, tabs.parent == nil else { return }
    var responder = next
    while let current = responder {
      if let parent = current as? UIViewController, let parentView = parent.viewIfLoaded, isDescendant(of: parentView) {
        parent.addChild(tabs)
        tabs.view.frame = bounds
        addSubview(tabs.view)
        tabs.didMove(toParent: parent)
        return
      }
      responder = current.next
    }
  }

  func setItems(_ newItems: [TabItem]) {
    guard newItems != items else { return }
    items = newItems
    tabs.setViewControllers(newItems.enumerated().map { index, item in
      let page = UIViewController()
      page.view.backgroundColor = .clear
      page.view.isUserInteractionEnabled = false
      page.view.accessibilityElementsHidden = true
      page.tabBarItem = UITabBarItem(title: item.title, image: UIImage(systemName: item.symbol), tag: index)
      page.tabBarItem.accessibilityIdentifier = "tab-\(item.id)"
      return page
    }, animated: false)
    setSelection(selection)
  }

  func setSelection(_ value: String) {
    selection = value
    if let index = items.firstIndex(where: { $0.id == value }), tabs.selectedIndex != index {
      tabs.selectedIndex = index
    }
  }

  func setColorScheme(_ scheme: String) {
    tabs.overrideUserInterfaceStyle = scheme == "dark" ? .dark : .light
  }

  func setSelectionColor(_ color: UIColor?) {
    tabs.tabBar.tintColor = color
  }

  func tabBarController(_ tabBarController: UITabBarController, didSelect viewController: UIViewController) {
    let index = tabBarController.selectedIndex
    guard items.indices.contains(index) else { return }
    selection = items[index].id
    onTabSelect(["id": selection])
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard let hit = super.hitTest(point, with: event),
          hit === tabs.tabBar || hit.isDescendant(of: tabs.tabBar) else { return nil }
    return hit
  }
}
