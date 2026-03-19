import Foundation
import FirebaseFirestore

struct Project: Codable, Identifiable, Hashable, Sendable {
    @DocumentID var id: String?
    var clientId: String
    var name: String
    var status: Status
    var createdAt: Date

    enum Status: String, Codable, CaseIterable, Sendable {
        case active
        case completed
        case paused

        var displayName: String {
            switch self {
            case .active: return "Active"
            case .completed: return "Completed"
            case .paused: return "Paused"
            }
        }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case clientId
        case name
        case status
        case createdAt
    }

    init(
        id: String? = nil,
        clientId: String,
        name: String,
        status: Status = .active,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.clientId = clientId
        self.name = name
        self.status = status
        self.createdAt = createdAt
    }
}

extension Project {
    func toFirestoreData() -> [String: Any] {
        [
            "clientId": clientId,
            "name": name,
            "status": status.rawValue,
            "createdAt": Timestamp(date: createdAt)
        ]
    }

    static func from(document: DocumentSnapshot) -> Project? {
        try? document.data(as: Project.self)
    }
}
