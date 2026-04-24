export async function transcribeWithNoopProvider() {
    return {
        text: '',
        provider: 'noop',
    };
}
