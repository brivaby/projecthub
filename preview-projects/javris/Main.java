import java.awt.BorderLayout;
import java.awt.Font;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Locale;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;

public class Main {
    private final JTextArea chatArea;
    private final JTextField inputField;

    public Main() {
        JFrame frame = new JFrame("J.A.R.V.I.S");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setSize(700, 500);
        frame.setLocationRelativeTo(null);
        frame.setLayout(new BorderLayout(10, 10));

        chatArea = new JTextArea();
        chatArea.setEditable(false);
        chatArea.setLineWrap(true);
        chatArea.setWrapStyleWord(true);
        chatArea.setFont(new Font("SansSerif", Font.PLAIN, 16));
        chatArea.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        JScrollPane scrollPane = new JScrollPane(chatArea);

        JPanel bottomPanel = new JPanel(new BorderLayout(10, 10));
        inputField = new JTextField();
        JButton sendButton = new JButton("Send");

        bottomPanel.add(inputField, BorderLayout.CENTER);
        bottomPanel.add(sendButton, BorderLayout.EAST);
        bottomPanel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        frame.add(scrollPane, BorderLayout.CENTER);
        frame.add(bottomPanel, BorderLayout.SOUTH);

        sendButton.addActionListener(e -> handleInput());
        inputField.addActionListener(e -> handleInput());

        addBotMessage("System online.\nGood day! I am JARVIS.\nHow may I assist you?\nType 'exit' to shut down.");

        frame.setVisible(true);
    }

    private void handleInput() {
        String message = inputField.getText().trim();
        if (message.isEmpty()) {
            return;
        }

        addUserMessage(message);
        inputField.setText("");

        String lower = message.toLowerCase(Locale.ENGLISH);

        if (lower.equals("exit")) {
            addBotMessage("Signing off. Goodbye!");
            System.exit(0);
        } else if (lower.contains("hello")) {
            addBotMessage("Hello! How can I assist you?");
        } else if (lower.contains("your name")) {
            addBotMessage("I am your personal assistant.");
        } else if (lower.contains("time")) {
            addBotMessage("The time is " + LocalTime.now().withNano(0));
        } else if (lower.contains("date")) {
            addBotMessage("Today's date is " + LocalDate.now());
        } else if (lower.contains("how are you")) {
            addBotMessage("All systems operational!");
        } else if (lower.contains("help")) {
            addBotMessage("I am ready to assist you.");
        } else {
            addBotMessage("I am still learning.");
        }
    }

    private void addUserMessage(String text) {
        chatArea.append("YOU: " + text + "\n");
        chatArea.setCaretPosition(chatArea.getDocument().getLength());
    }

    private void addBotMessage(String text) {
        chatArea.append("JARVIS: " + text + "\n");
        chatArea.setCaretPosition(chatArea.getDocument().getLength());
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(Main::new);
    }
}

 