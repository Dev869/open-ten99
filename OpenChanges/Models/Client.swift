import Foundation
import FirebaseFirestore

struct Client: Codable, Identifiable, Hashable, Sendable {
    @DocumentID var id: String?
    var name: String
    var email: String
    var phone: String?
    var company: String?
    var notes: String?
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case email
        case phone
        case company
        case notes
        case createdAt
    }

    init(
        id: String? = nil,
        name: String,
        email: String,
        phone: String? = nil,
        company: String? = nil,
        notes: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.email = email
        self.phone = phone
        self.company = company
        self.notes = notes
        self.createdAt = createdAt
    }
}

extension Client {
    /// Converts the client to a Firestore-compatible dictionary.
    func toFirestoreData() -> [String: Any] {
        var data: [String: Any] = [
            "name": name,
            "email": email,
            "createdAt": Timestamp(date: createdAt)
        ]
        if let phone { data["phone"] = phone }
        if let company { data["company"] = company }
        if let notes { data["notes"] = notes }
        return data
    }

    /// Creates a Client from a Firestore document snapshot.
    static func from(document: DocumentSnapshot) -> Client? {
        try? document.data(as: Client.self)
    }
}
