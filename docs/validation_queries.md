# Multi-Step Orchestration Validation Queries

Run with `USE_PLAN=true` (plan mode is OFF by default).

## Scenario 1: Weather + Exchange Rate

**Query:** What's the weather in Berlin and the GBP to ILS exchange rate?

**Expected plan:**
- getWeather(city: "Berlin")
- getExchangeRate(from: "GBP", to: "ILS")
- final_answer_synthesis_required: true

## Scenario 2: Review Analysis + Product RAG

**Query:** Analyze this review about the Smart Watch S5: "Great battery life but the band is uncomfortable." What are its specs?

**Expected plan:**
- analyzeReview(reviewText: ...)
- getProductInformation(product_name: "Smart Watch S5", query: "specs")
- final_answer_synthesis_required: true

## Scenario 3: Exchange + Product + Math

**Query:** Laptop Pro X1 costs how much in USD? Convert that to shekels and add 50.

**Expected plan:**
- getProductInformation(product_name: "Laptop Pro X1", query: "price")
- getExchangeRate(from: "USD", to: "ILS")
- calculateMath(expression: "<result_from_tool_1> * <result_from_tool_2> + 50")
- final_answer_synthesis_required: true

## Bilingual

- Hebrew: "מה מזג האוויר בתל אביב ומשקל הדולר בשקלים?"
- English: Same scenario in English — verify synthesized answer matches query language.
