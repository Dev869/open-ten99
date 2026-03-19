import SwiftUI

struct FilterTabs: View {
    let tabs: [String]
    @Binding var selected: String
    @Environment(ThemeManager.self) private var theme

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(tabs, id: \.self) { tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selected = tab
                        }
                    } label: {
                        Text(tab)
                            .font(.subheadline)
                            .fontWeight(selected == tab ? .semibold : .regular)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(
                                Capsule()
                                    .fill(selected == tab ? theme.accentColor : Color.white)
                            )
                            .foregroundStyle(selected == tab ? .white : .secondary)
                            .overlay(
                                Capsule()
                                    .strokeBorder(
                                        selected == tab ? Color.clear : Color.gray.opacity(0.3),
                                        lineWidth: 1
                                    )
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
        }
    }
}

#Preview {
    @Previewable @State var selected = "All"
    FilterTabs(
        tabs: ["All", "Change Requests", "Feature Requests", "Maintenance"],
        selected: $selected
    )
}
